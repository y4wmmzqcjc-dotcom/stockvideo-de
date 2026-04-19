/* upload.js — Canvas+MediaRecorder watermarked preview pipeline (no ffmpeg.wasm) */
(function(){
  function slugify(s){return (s||'').toString().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80)||'video';}
  window.slugifyKey=slugify;
  function genVideoId(){return 'stockvideo.de-'+Date.now().toString(36).toUpperCase().slice(-5)+Math.random().toString(36).substring(2,5).toUpperCase();}

  function loadVideoMeta(file){
    return new Promise(function(resolve,reject){
      const url=URL.createObjectURL(file);
      const v=document.createElement('video');
      v.preload='metadata'; v.muted=true; v.playsInline=true;
      v.onloadedmetadata=function(){resolve({w:v.videoWidth,h:v.videoHeight,dur:v.duration,url:url,el:v});};
      v.onerror=function(){reject(new Error('video metadata load failed'));};
      v.src=url;
    });
  }

  async function extractThumbnailBlob(file){
    const meta=await loadVideoMeta(file);
    const v=meta.el;
    const tries=[meta.dur*0.1, meta.dur*0.3, meta.dur*0.5, meta.dur*0.7, 1];
    let best=null,bestScore=-1;
    for(const t of tries){
      try{
        await new Promise((res,rej)=>{v.onseeked=res;v.onerror=rej;v.currentTime=Math.max(0.1,Math.min(meta.dur-0.1,t));});
        const c=document.createElement('canvas');
        const W=1280, H=Math.round(1280*meta.h/meta.w);
        c.width=W;c.height=H;
        const ctx=c.getContext('2d');
        ctx.drawImage(v,0,0,W,H);
        // brightness score
        const data=ctx.getImageData(W/2-50,H/2-50,100,100).data;
        let sum=0;for(let i=0;i<data.length;i+=4)sum+=data[i]+data[i+1]+data[i+2];
        const score=sum/(data.length/4);
        if(score>bestScore){bestScore=score;best=await new Promise(r=>c.toBlob(r,'image/jpeg',0.85));}
        if(score>120) break;
      }catch(e){}
    }
    URL.revokeObjectURL(meta.url);
    return best;
  }

  // Cache the logo across multiple makeWatermarkPng calls in one upload session
  // (called once per resolution: 480p preview + 360p hover loop)
  let _logoImgP=null;
  function loadLogoImg(){
    if(_logoImgP) return _logoImgP;
    _logoImgP=new Promise(function(resolve,reject){
      const img=new Image();
      img.onload=function(){resolve(img);};
      img.onerror=function(){reject(new Error('sv-logo.png load failed'));};
      img.src='/watermark/sv-logo.png';
    });
    return _logoImgP;
  }

  async function makeWatermarkPng(W,H,videoId){
    const c=document.createElement('canvas');c.width=W;c.height=H;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,W,H);
    // Center logo (replaces both the diagonal tiled text AND the big "stockvideo.de" text)
    try{
      const logo=await loadLogoImg();
      // Scale logo to ~38% of frame width, preserve aspect ratio
      const targetW=Math.round(W*0.38);
      const targetH=Math.round(targetW*(logo.height/logo.width));
      ctx.globalAlpha=0.28;
      ctx.drawImage(logo, Math.round((W-targetW)/2), Math.round((H-targetH)/2), targetW, targetH);
      ctx.globalAlpha=1.0;
    }catch(e){
      // Fallback to text if logo can't be loaded
      ctx.font='bold '+Math.round(H/8)+'px sans-serif';
      ctx.fillStyle='rgba(255,255,255,0.28)';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText('stockvideo.de',W/2,H/2);
    }
    // ID badge bottom-right (unchanged)
    ctx.font='bold '+Math.round(H/26)+'px monospace';
    ctx.textAlign='right';
    ctx.textBaseline='bottom';
    const pad=Math.round(H/40);
    const idTxt='ID '+videoId;
    const m=ctx.measureText(idTxt);
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(W-m.width-pad*2-pad, H-Math.round(H/22)-pad*2, m.width+pad*2, Math.round(H/22)+pad);
    ctx.fillStyle='#fff';
    ctx.fillText(idTxt,W-pad*2,H-pad*1.2);
    return new Promise(r=>c.toBlob(r,'image/png'));
  }
  window.makeWatermarkPng=makeWatermarkPng;

  function pickMime(){
    if(typeof MediaRecorder==='undefined') return '';
    // Safari throws "The string did not match the expected pattern." when mimeType is
    // specified but the encoder rejects it at construction time — even if isTypeSupported()
    // returned true.  Work around by verifying via a dummy constructor.
    const cands=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];
    for(const m of cands){
      if(!MediaRecorder.isTypeSupported(m)) continue;
      try{
        // Verify the mimeType actually works at construction time
        const s=document.createElement('canvas').captureStream();
        const r=new MediaRecorder(s,{mimeType:m});
        r.stop();
        return m;
      }catch(e){}
    }
    return ''; // Let the browser choose (Safari default — mp4 on macOS/iOS)
  }

  async function recordPreview(file, targetH, hoverDur, videoId, onStatus){
    const meta=await loadVideoMeta(file);
    const v=meta.el;
    const iw=meta.w, ih=meta.h, dur=meta.dur;
    const tw=Math.max(2, Math.round(targetH*iw/ih/2)*2);
    const th=targetH;
    const c=document.createElement('canvas');
    c.width=tw; c.height=th;
    const ctx=c.getContext('2d',{alpha:false});
    const wmBlob=await makeWatermarkPng(tw,th,videoId);
    const wmImg=new Image();
    const wmUrl=URL.createObjectURL(wmBlob);
    wmImg.src=wmUrl;
    await new Promise(r=>{wmImg.onload=r;});

    v.muted=true; v.playsInline=true;
    v.currentTime=0;
    await new Promise(r=>{v.onseeked=r;});

    const stream=(c.captureStream||c.mozCaptureStream).call(c,24);
    const mime=pickMime();
    const bps = targetH===480 ? 1500000 : 700000;
    let rec;
    try{
      rec=new MediaRecorder(stream, mime ? {mimeType:mime, videoBitsPerSecond:bps} : {videoBitsPerSecond:bps});
    }catch(e){
      // Final fallback: no options at all (Safari mp4 default)
      rec=new MediaRecorder(stream);
    }
    const chunks=[];
    rec.ondataavailable=function(e){if(e.data && e.data.size) chunks.push(e.data);};

    const limit=hoverDur ? hoverDur*1000 : Math.min(dur*1000, 60000);
    // Use the recorder's actual mimeType (may differ from requested, esp. on Safari)
    const stopP=new Promise(res=>{rec.onstop=function(){const actualMime=rec.mimeType||mime||'video/mp4';res(new Blob(chunks,{type:actualMime}));};});

    // SKIP BLACK INTRO: scan source for first non-dark frame, seek there before recording
    await new Promise((R)=>{
      var dur=v.duration||1;
      var samples=[0.05,0.2,0.4,0.7,1.0,1.4,1.8,2.3,2.8,3.4,4.0,4.8,5.6,6.5,7.5,8.5];
      var probe=document.createElement("canvas");probe.width=32;probe.height=18;
      var pctx=probe.getContext("2d",{willReadFrequently:true});
      var idx=0;var found=-1;
      var next=function(){
        if(found>=0||idx>=samples.length||samples[idx]>=dur-0.1){
          var target=found>=0?found:Math.min(0.05,Math.max(0,dur-0.05));
          var done=false;v.onseeked=function(){if(done)return;done=true;v.onseeked=null;R();};
          try{v.currentTime=target;}catch(e){R();}
          setTimeout(function(){if(!done){done=true;R();}},800);
          return;
        }
        var ts=samples[idx++];
        var seekDone=false;
        v.onseeked=function(){if(seekDone)return;seekDone=true;v.onseeked=null;
          try{pctx.drawImage(v,0,0,32,18);var d=pctx.getImageData(0,0,32,18).data;var sum=0;for(var i=0;i<d.length;i+=4)sum+=d[i]+d[i+1]+d[i+2];var b=sum/(d.length/4*3);if(b>=45){found=ts;}}catch(e){}
          next();
        };
        try{v.currentTime=ts;}catch(e){next();}
        setTimeout(function(){if(!seekDone){seekDone=true;next();}},600);
      };
      next();
    });
    try{ctx.drawImage(v,0,0,c.width,c.height);}catch(e){}await v.play().catch(()=>{});await new Promise(r=>setTimeout(r,120));try{ctx.drawImage(v,0,0,c.width,c.height);}catch(e){}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));try{ctx.drawImage(v,0,0,c.width,c.height);}catch(e){}rec.start(250);
    const start=performance.now();
    let lastPct=-1;
    return new Promise((resolve)=>{
      function tick(){
        ctx.drawImage(v,0,0,tw,th);
        ctx.drawImage(wmImg,0,0,tw,th);
        const elapsed=performance.now()-start;
        const pct=Math.round(elapsed/limit*100);
        if(pct!==lastPct && onStatus){lastPct=pct; onStatus('Encoding '+targetH+'p... '+Math.min(99,pct)+'%');}
        if(elapsed<limit && !v.ended){
          requestAnimationFrame(tick);
        }else{
          try{v.pause();}catch(e){}
          rec.stop();
          stopP.then(b=>{URL.revokeObjectURL(wmUrl);URL.revokeObjectURL(meta.url);resolve({blob:b,mime:b.type||mime||'video/mp4'});});
        }
      }
      requestAnimationFrame(tick);
    });
  }

  async function encodePreviews(file, videoId, onStatus){
    onStatus && onStatus('Encoding 480p Preview...');
    const prev=await recordPreview(file, 480, 0, videoId, onStatus);
    onStatus && onStatus('Encoding 360p Hover-Loop...');
    const hov=await recordPreview(file, 360, 6, videoId, onStatus);
    return {previewBlob:prev.blob, hoverBlob:hov.blob, mime:prev.mime};
  }
  window.encodePreviews=encodePreviews;

  function putToR2(key, body, contentType, onProgress){
    return new Promise(function(resolve,reject){
      const xhr=new XMLHttpRequest();
      xhr.open('PUT','/admin/upload?key='+encodeURIComponent(key));
      xhr.setRequestHeader('Content-Type',contentType);
      // Admin-Auth Header (Pages-Function prueft gegen env.ADMIN_PASSWORD, wenn gesetzt).
      // Wir senden den clientseitigen Passwort-Hash — die Pages-Function akzeptiert Klartext ODER Hash.
      try {
        var _pwHash = (typeof localStorage!=='undefined' && localStorage.getItem('adminPasswordHash')) || '';
        if (_pwHash) xhr.setRequestHeader('X-Admin-Password', _pwHash);
      } catch(e) {}
      if(onProgress) xhr.upload.onprogress=function(e){if(e.lengthComputable) onProgress(e.loaded/e.total);};
      xhr.onload=function(){if(xhr.status>=200&&xhr.status<300) resolve(JSON.parse(xhr.responseText||'{}'));else reject(new Error('HTTP '+xhr.status+': '+xhr.responseText));};
      xhr.onerror=function(){reject(new Error('Network error'));};
      xhr.send(body);
    });
  }
  window.putToR2=putToR2;

  window.uploadVideo=async function(file, opts){
    opts=opts||{};
    const baseSlug=slugify(opts.slug || file.name.replace(/\.[^.]+$/,''));
    const ext=(file.name.match(/\.[a-z0-9]+$/i)||['.mp4'])[0].toLowerCase();
    const videoId=opts.videoId || genVideoId();
    const videoKey='videos/'+baseSlug+ext;
    const thumbKey='thumbs/'+baseSlug+'.jpg';
    const status=opts.onStatus||function(){};

    status('Thumbnail wird erzeugt...');
    const thumbBlob=await extractThumbnailBlob(file);
    status('Thumbnail wird hochgeladen...');
    await putToR2(thumbKey, thumbBlob, 'image/jpeg');

    let previewKey='', hoverKey='', previewOk=false;
    try{
      const enc=await encodePreviews(file, videoId, status);
      const pext = enc.mime.indexOf('mp4')>=0 ? '.mp4' : '.webm';
      previewKey='previews/'+baseSlug+pext;
      hoverKey='previews/'+baseSlug+'-hover'+pext;
      status('Preview wird hochgeladen...');
      await putToR2(previewKey, enc.previewBlob, enc.mime.split(';')[0]);
      status('Hover-Loop wird hochgeladen...');
      await putToR2(hoverKey, enc.hoverBlob, enc.mime.split(';')[0]);
      previewOk=true;
    }catch(e){
      console.error('Preview encode failed', e);
      status('Preview-Encoding fehlgeschlagen ('+(e.message||e)+'), fahre ohne Preview fort');
    }

    if(!opts.skipOriginal){
      status('Originalvideo wird hochgeladen...');
      await putToR2(videoKey, file, file.type||'video/mp4', opts.onProgress);
    }

    status(previewOk ? 'Fertig (mit Preview).' : 'Fertig (ohne Preview).');
    return {videoKey:videoKey, thumbKey:thumbKey, previewKey:previewOk?previewKey:'', hoverKey:previewOk?hoverKey:'', slug:baseSlug, videoId:videoId};
  };
})();
