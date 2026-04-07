(function(){
  function slugify(s){
    return (s||'').toString()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
      .replace(/Ä/g,'ae').replace(/Ö/g,'oe').replace(/Ü/g,'ue')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  }
  window.slugifyKey = slugify;

  function extractThumbnail(file){
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.playsInline = true;
      v.src = URL.createObjectURL(file);
      const candidates = [];
      let phase = 'meta';
      let triedTimes = [];
      function snapAt(time){
        return new Promise(res=>{
          const onSeek = () => {
            v.removeEventListener('seeked', onSeek);
            requestAnimationFrame(()=>requestAnimationFrame(()=>{
              try {
                const w = Math.min(1280, v.videoWidth || 1280);
                const h = Math.round((v.videoHeight || 720) * (w / (v.videoWidth || 1280)));
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                ctx.drawImage(v, 0, 0, w, h);
                // sample brightness
                const sw=40, sh=22;
                const sc = document.createElement('canvas');
                sc.width=sw; sc.height=sh;
                sc.getContext('2d').drawImage(c,0,0,sw,sh);
                const d = sc.getContext('2d').getImageData(0,0,sw,sh).data;
                let lum=0;
                for(let i=0;i<d.length;i+=4) lum += (d[i]+d[i+1]+d[i+2])/3;
                lum /= (d.length/4);
                res({canvas:c, lum, time});
              } catch(e){ res({canvas:null, lum:0, time, err:e}); }
            }));
          };
          v.addEventListener('seeked', onSeek);
          v.currentTime = time;
        });
      }
      v.onloadedmetadata = async () => {
        try {
          const dur = v.duration || 2;
          const times = [dur*0.5, dur*0.25, dur*0.75, dur*0.1, Math.min(1, dur/2)];
          for(const tm of times){
            if(tm<=0||!isFinite(tm)) continue;
            const r = await snapAt(tm);
            if(r.canvas){ candidates.push(r); if(r.lum>20) break; }
          }
          if(!candidates.length) return reject(new Error('no frames'));
          candidates.sort((a,b)=>b.lum-a.lum);
          const best = candidates[0].canvas;
          best.toBlob(b => {
            URL.revokeObjectURL(v.src);
            b ? resolve(b) : reject(new Error('blob fail'));
          }, 'image/jpeg', 0.85);
        } catch(e){ reject(e); }
      };
      v.onerror = () => reject(new Error('video load error'));
    });
  }

  function putToR2(key, body, contentType, onProgress){
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', '/admin/upload?key=' + encodeURIComponent(key));
      xhr.setRequestHeader('Content-Type', contentType);
      if (onProgress) xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText || '{}')); else reject(new Error('HTTP ' + xhr.status + ': ' + xhr.responseText)); };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(body);
    });
  }

  window.uploadVideo = async function(file, opts){
    opts = opts || {};
    const baseSlug = slugify(opts.slug || file.name.replace(/\.[^.]+$/, ''));
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase();
    const videoKey = 'videos/' + baseSlug + ext;
    const thumbKey = 'thumbs/' + baseSlug + '.jpg';

    if (opts.onStatus) opts.onStatus('Thumbnail wird erzeugt...');
    const thumbBlob = await extractThumbnail(file);

    if (opts.onStatus) opts.onStatus('Thumbnail wird hochgeladen...');
    await putToR2(thumbKey, thumbBlob, 'image/jpeg');

    if (opts.onStatus) opts.onStatus('Video wird hochgeladen...');
    await putToR2(videoKey, file, file.type || 'video/mp4', opts.onProgress);

    if (opts.onStatus) opts.onStatus('Fertig.');
    return { videoKey, thumbKey, slug: baseSlug };
  };
})();
