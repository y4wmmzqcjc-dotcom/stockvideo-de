// Schlanker Upload-Helper: Auto-Thumbnail + Direkt-Upload zu R2 via /admin/upload
(function(){
  const slugify = s => (s||'').toString().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || ('video-'+Date.now());

  function extractThumbnail(file){
    return new Promise((resolve,reject)=>{
      const v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true; v.playsInline = true;
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration||2)/2); };
      v.onseeked = () => {
        const c = document.createElement('canvas');
        const w = Math.min(1280, v.videoWidth||1280);
        c.width = w; c.height = Math.round((v.videoHeight||720) * (w/(v.videoWidth||1280)));
        c.getContext('2d').drawImage(v,0,0,c.width,c.height);
        c.toBlob(b => { URL.revokeObjectURL(v.src); b ? resolve(b) : reject(new Error('thumb')); }, 'image/jpeg', 0.85);
      };
      v.onerror = () => reject(new Error('video load'));
    });
  }

  async function putToR2(blob, key, contentType, token, onProgress){
    return new Promise((resolve,reject)=>{
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', '/admin/upload?key=' + encodeURIComponent(key));
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded/e.total); };
      xhr.onload = () => xhr.status>=200 && xhr.status<300 ? resolve(JSON.parse(xhr.responseText||'{}')) : reject(new Error('HTTP '+xhr.status+': '+xhr.responseText));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(blob);
    });
  }

  async function uploadVideo(file, opts){
    opts = opts || {};
    const token = opts.token || window.__adminUploadToken || localStorage.getItem('adminUploadToken') || prompt('Upload-Token (ADMIN_TOKEN aus Cloudflare):');
    if (token) localStorage.setItem('adminUploadToken', token);
    if (!token) throw new Error('Kein Upload-Token');
    window.__adminUploadToken = token;
    const baseSlug = slugify(opts.slug || file.name.replace(/\.[^.]+$/,''));
    const ext = (file.name.match(/\.[^.]+$/)||['.mp4'])[0].toLowerCase();
    const videoKey = 'videos/' + baseSlug + ext;
    const thumbKey = 'thumbs/' + baseSlug + '.jpg';
    opts.onStatus && opts.onStatus('Thumbnail erzeugen…');
    const thumb = await extractThumbnail(file);
    opts.onStatus && opts.onStatus('Thumbnail hochladen…');
    await putToR2(thumb, thumbKey, 'image/jpeg', token);
    opts.onStatus && opts.onStatus('Video hochladen…');
    await putToR2(file, videoKey, file.type||'video/mp4', token, p => opts.onProgress && opts.onProgress(p));
    opts.onStatus && opts.onStatus('Fertig.');
    return { videoKey, thumbKey, slug: baseSlug };
  }

  window.uploadVideo = uploadVideo;
  window.slugifyKey = slugify;
})();
