
(function(){
  function slugify(s){return (s||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/Ä/g,'ae').replace(/Ö/g,'oe').replace(/Ü/g,'ue').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);}
  window.slugifyKey = slugify;

  function genVideoId(){
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    const t = Date.now().toString(36).slice(-3).toUpperCase();
    return 'SV-'+t+rand;
  }
  window.genVideoId = genVideoId;

  function loadVideoMeta(file){
    return new Promise((resolve,reject)=>{
      const v=document.createElement('video');
      v.preload='metadata'; v.muted=true; v.playsInline=true;
      const url = (file instanceof Blob) ? URL.createObjectURL(file) : file;
      v.src = url;
      v.onloadedmetadata=()=>resolve({video:v, w:v.videoWidth, h:v.videoHeight, dur:v.duration||0, url});
      v.onerror=()=>reject(new Error('video load error'));
    });
  }

  async function extractThumbnailBlob(file){
    const meta = await loadVideoMeta(file);
    const v = meta.video; const dur = meta.dur;
    function snap(time){return new Promise(res=>{
      const onSeek=()=>{v.removeEventListener('seeked',onSeek);
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          try{
            const w=Math.min(1280, v.videoWidth||1280);
            const h=Math.round((v.videoHeight||720)*(w/(v.videoWidth||1280)));
            const c=document.createElement('canvas'); c.width=w; c.height=h;
            c.getContext('2d').drawImage(v,0,0,w,h);
            const sw=40,sh=22;
            const sc=document.createElement('canvas'); sc.width=sw; sc.height=sh;
            sc.getContext('2d').drawImage(c,0,0,sw,sh);
            const d=sc.getContext('2d').getImageData(0,0,sw,sh).data;
            let lum=0;
            for(let i=0;i<d.length;i+=4) lum += (d[i]+d[i+1]+d[i+2])/3;
            lum /= (d.length/4);
            res({canvas:c,lum,time});
          }catch(e){res({canvas:null,lum:0,time});}
        }));
      };
      v.addEventListener('seeked',onSeek);
      v.currentTime=time;
    });}
    const times=[dur*0.5,dur*0.25,dur*0.75,dur*0.1,Math.min(1,dur/2)].filter(t=>t>0&&isFinite(t));
    const cands=[];
    for(const t of times){const r=await snap(t); if(r.canvas){cands.push(r); if(r.lum>20) break;}}
    URL.revokeObjectURL(meta.url);
    if(!cands.length) throw new Error('no frames');
    cands.sort((a,b)=>b.lum-a.lum);
    return new Promise((res,rej)=>cands[0].canvas.toBlob(b=>b?res(b):rej(new Error('blob fail')),'image/jpeg',0.85));
  }

  function makeWatermarkPng(width, height, videoId){
    const c=document.createElement('canvas'); c.width=width; c.height=height;
    const x=c.getContext('2d'); x.clearRect(0,0,width,height);
    x.save();
    x.translate(width/2,height/2);
    x.rotate(-22*Math.PI/180);
    x.font='700 '+Math.round(height*0.10)+'px sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillStyle='rgba(255,255,255,0.28)';
    x.shadowColor='rgba(0,0,0,0.65)'; x.shadowBlur=6;
    x.fillText('stockvideo.de',0,0);
    x.shadowBlur=0;
    x.restore();
    const tile = 'stockvideo.de  '+videoId;
    x.save();
    x.translate(width/2,height/2);
    x.rotate(-22*Math.PI/180);
    x.font='600 '+Math.round(height*0.028)+'px sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillStyle='rgba(255,255,255,0.18)';
    const stepX=Math.round(width*0.34), stepY=Math.round(height*0.20);
    for(let yy=-height; yy<=height; yy+=stepY){
      for(let xx=-width; xx<=width; xx+=stepX){
        x.fillText(tile, xx, yy);
      }
    }
    x.restore();
    x.save();
    x.font='700 '+Math.round(height*0.04)+'px sans-serif';
    x.textBaseline='top';
    const txt = videoId;
    const padX=Math.round(height*0.02), padY=Math.round(height*0.012);
    const tw = x.measureText(txt).width;
    const th = Math.round(height*0.04);
    x.fillStyle='rgba(0,0,0,0.6)';
    x.fillRect(width-tw-padX*2-12, 12, tw+padX*2, th+padY*2);
    x.fillStyle='rgba(255,255,255,0.95)';
    x.fillText(txt, width-tw-padX-12, 12+padY);
    x.restore();
    return new Promise(res=>c.toBlob(b=>res(b),'image/png'));
  }

  let _ffmpegReady=null;
  async function getFfmpeg(){
    if(_ffmpegReady) return _ffmpegReady;
    _ffmpegReady = (async()=>{
      const ff = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
      const ut = await import('https://esm.sh/@ffmpeg/util@0.12.1');
      const ffmpeg = new ff.FFmpeg();
      ffmpeg.on('log', function(ev){ if(window._ffLog) window._ffLog(ev.message); });
      ffmpeg.on('progress', function(ev){ if(window._ffProg) window._ffProg(ev.progress); });
      const baseURL='https://esm.sh/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await ut.toBlobURL(baseURL+'/ffmpeg-core.js','text/javascript'),
        wasmURL: await ut.toBlobURL(baseURL+'/ffmpeg-core.wasm','application/wasm')
      });
      return {ffmpeg:ffmpeg, util:ut};
    })();
    return _ffmpegReady;
  }
  window.getFfmpeg = getFfmpeg;

  async function encodePreviews(file, videoId, onStatus){
    const meta = await loadVideoMeta(file);
    const iw = meta.w||1920, ih = meta.h||1080;
    const dur = meta.dur||0;
    URL.revokeObjectURL(meta.url);

    const tw480 = Math.max(2, Math.round(480*iw/ih/2)*2);
    const th480 = 480;
    const tw360 = Math.max(2, Math.round(360*iw/ih/2)*2);
    const th360 = 360;

    onStatus && onStatus('ffmpeg.wasm wird geladen (einmalig ca. 30 MB)...');
    const ffData = await getFfmpeg();
    const ffmpeg = ffData.ffmpeg;

    onStatus && onStatus('Wasserzeichen wird erzeugt...');
    const wm480 = await makeWatermarkPng(tw480, th480, videoId);
    const wm360 = await makeWatermarkPng(tw360, th360, videoId);

    onStatus && onStatus('Datei wird in ffmpeg geladen...');
    const buf = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile('in.mp4', buf);
    await ffmpeg.writeFile('wm480.png', new Uint8Array(await wm480.arrayBuffer()));
    await ffmpeg.writeFile('wm360.png', new Uint8Array(await wm360.arrayBuffer()));

    window._ffProg = function(p){ onStatus && onStatus('Encoding 480p Preview... '+Math.round((p||0)*100)+'%'); };
    onStatus && onStatus('Encoding 480p Preview...');
    await ffmpeg.exec([
      '-i','in.mp4','-i','wm480.png',
      '-filter_complex','[0:v]scale='+tw480+':'+th480+',setsar=1[v];[v][1:v]overlay=0:0',
      '-c:v','libx264','-preset','veryfast','-crf','28','-pix_fmt','yuv420p',
      '-an','-movflags','+faststart','out480.mp4'
    ]);
    const prev = await ffmpeg.readFile('out480.mp4');

    window._ffProg = function(p){ onStatus && onStatus('Encoding 360p Hover... '+Math.round((p||0)*100)+'%'); };
    onStatus && onStatus('Encoding 360p Hover-Loop...');
    const hoverDur = Math.min(6, Math.max(2, dur||4));
    await ffmpeg.exec([
      '-i','in.mp4','-i','wm360.png','-t', String(hoverDur),
      '-filter_complex','[0:v]scale='+tw360+':'+th360+',setsar=1,fps=24[v];[v][1:v]overlay=0:0',
      '-c:v','libx264','-preset','veryfast','-crf','30','-pix_fmt','yuv420p',
      '-an','-movflags','+faststart','out360.mp4'
    ]);
    const hover = await ffmpeg.readFile('out360.mp4');

    try{ await ffmpeg.deleteFile('in.mp4'); }catch(e){}
    try{ await ffmpeg.deleteFile('out480.mp4'); }catch(e){}
    try{ await ffmpeg.deleteFile('out360.mp4'); }catch(e){}
    try{ await ffmpeg.deleteFile('wm480.png'); }catch(e){}
    try{ await ffmpeg.deleteFile('wm360.png'); }catch(e){}

    return {
      previewBlob: new Blob([prev.buffer], {type:'video/mp4'}),
      hoverBlob: new Blob([hover.buffer], {type:'video/mp4'})
    };
  }
  window.encodePreviews = encodePreviews;

  function putToR2(key, body, contentType, onProgress){
    return new Promise(function(resolve,reject){
      const xhr=new XMLHttpRequest();
      xhr.open('PUT','/admin/upload?key='+encodeURIComponent(key));
      xhr.setRequestHeader('Content-Type',contentType);
      if(onProgress) xhr.upload.onprogress=function(e){ if(e.lengthComputable) onProgress(e.loaded/e.total); };
      xhr.onload=function(){ if(xhr.status>=200&&xhr.status<300) resolve(JSON.parse(xhr.responseText||'{}')); else reject(new Error('HTTP '+xhr.status+': '+xhr.responseText)); };
      xhr.onerror=function(){ reject(new Error('Network error')); };
      xhr.send(body);
    });
  }
  window.putToR2 = putToR2;

  window.uploadVideo = async function(file, opts){
    opts = opts || {};
    const baseSlug = slugify(opts.slug || file.name.replace(/\.[^.]+$/,''));
    const ext = (file.name.match(/\.[a-z0-9]+$/i)||['.mp4'])[0].toLowerCase();
    const videoId = opts.videoId || genVideoId();
    const videoKey = 'videos/'+baseSlug+ext;
    const thumbKey = 'thumbs/'+baseSlug+'.jpg';
    const previewKey = 'previews/'+baseSlug+'.mp4';
    const hoverKey = 'previews/'+baseSlug+'-hover.mp4';
    const status = opts.onStatus || function(){};

    status('Thumbnail wird erzeugt...');
    const thumbBlob = await extractThumbnailBlob(file);
    status('Thumbnail wird hochgeladen...');
    await putToR2(thumbKey, thumbBlob, 'image/jpeg');

    let previewOk=false;
    try{
      const enc = await encodePreviews(file, videoId, status);
      status('Preview (480p) wird hochgeladen...');
      await putToR2(previewKey, enc.previewBlob, 'video/mp4');
      status('Hover-Loop (360p) wird hochgeladen...');
      await putToR2(hoverKey, enc.hoverBlob, 'video/mp4');
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
    return {
      videoKey: videoKey,
      thumbKey: thumbKey,
      previewKey: previewOk ? previewKey : '',
      hoverKey: previewOk ? hoverKey : '',
      slug: baseSlug,
      videoId: videoId
    };
  };
})();
