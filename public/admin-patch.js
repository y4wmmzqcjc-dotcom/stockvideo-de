// admin-patch.js — v20260421B
// Erweiterungen: Sortierung (neu zuerst) | Ampel-Indikator | Batch-Upload
(function () {
  'use strict';

  var R2_BASE = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';

  // ── 1. METADATEN-VOLLSTÄNDIGKEIT ─────────────────────────────────
  function isComplete(v) {
    return !!(
      v.title && v.title.trim() &&
      v.description && v.description.trim() &&
      v.tags && Array.isArray(v.tags) && v.tags.length > 0 &&
      v.category && v.category.trim()
    );
  }

  function getMissing(v) {
    var m = [];
    if (!v.title || !v.title.trim()) m.push('Titel');
    if (!v.description || !v.description.trim()) m.push('Beschreibung');
    if (!v.tags || !v.tags.length) m.push('Schlagwörter');
    if (!v.category || !v.category.trim()) m.push('Kategorie');
    return m;
  }

  // ── 2. AMPEL ─────────────────────────────────────────────────────
  function injectAmpels() {
    var items = document.querySelectorAll('#videoListItems .video-item');
    items.forEach(function (item, i) {
      var v = admin.videos[i];
      if (!v) return;
      var old = item.querySelector('.bw-ampel');
      if (old) old.remove();
      var ok = isComplete(v);
      var missing = getMissing(v);
      var color = ok ? '#22c55e' : '#ef4444';
      var glow  = ok ? '#22c55e55' : '#ef444455';
      var tip   = ok ? 'Alle Metadaten vollständig — bereit zur Veröffentlichung' : 'Fehlend: ' + missing.join(', ');
      var dot = document.createElement('span');
      dot.className = 'bw-ampel';
      dot.title = tip;
      dot.style.cssText = 'display:inline-block;width:11px;height:11px;border-radius:50%;background:' + color + ';box-shadow:0 0 7px 2px ' + glow + ';margin-right:8px;flex-shrink:0;vertical-align:middle;cursor:help;transition:background .3s,box-shadow .3s;';
      var titleEl = item.querySelector('.list-item-title, [class*="title"]');
      if (!titleEl) titleEl = item.firstElementChild;
      if (!titleEl) return;
      var par = titleEl.parentElement || item;
      if (getComputedStyle(par).display !== 'flex') {
        par.style.display = 'flex';
        par.style.alignItems = 'center';
      }
      par.insertBefore(dot, titleEl);
    });
  }

  // ── 3. SORTIERUNG (neueste zuerst) ───────────────────────────────
  var _origRender = admin.renderVideosList.bind(admin);
  admin.renderVideosList = function () {
    admin.videos.sort(function (a, b) { return Number(b.id) - Number(a.id); });
    _origRender();
    setTimeout(injectAmpels, 80);
  };

  var _origSave = admin.saveVideo.bind(admin);
  admin.saveVideo = function () {
    _origSave();
    setTimeout(injectAmpels, 250);
  };

  // ── 4. PUBLISH-FILTER ────────────────────────────────────────────
  var _origPublish = admin.publishToGitHub.bind(admin);
  admin.publishToGitHub = function () {
    var raw = localStorage.getItem('adminVideos');
    var all = JSON.parse(raw || '[]');
    var complete = all.filter(isComplete);
    var draftCount = all.length - complete.length;

    if (draftCount > 0) {
      var draftNames = all
        .filter(function (v) { return !isComplete(v); })
        .map(function (v) { return '"' + (v.title || 'Unbenannt') + '"'; })
        .join(', ');
      var go = confirm(
        draftCount + ' Video(s) mit roter Ampel werden NICHT veroeffentlicht:\n' +
        draftNames + '\n\nNur ' + complete.length + ' vollstaendige Video(s) gehen live.\nFortfahren?'
      );
      if (!go) return;
      localStorage.setItem('adminVideos', JSON.stringify(complete));
    }

    var result = _origPublish();

    if (draftCount > 0) {
      var restore = function () { localStorage.setItem('adminVideos', raw); };
      if (result && typeof result.then === 'function') {
        result.then(restore, restore);
      } else {
        setTimeout(restore, 8000);
      }
    }
    return result;
  };

  // ── 5. BATCH-UPLOAD ──────────────────────────────────────────────
  function slugFromFile(name) {
    return name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/ae/g,'ae').replace(/oe/g,'oe').replace(/ue/g,'ue')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 55) + '-4k-stock-video';
  }

  function uniqueSlug(base) {
    var s = base, n = 2;
    while (admin.videos.some(function (v) { return v.slug === s; })) {
      s = base.replace(/-4k-stock-video$/, '') + '-' + n + '-4k-stock-video';
      n++;
    }
    return s;
  }

  function addVideoEntry(slug, videoId, title) {
    var entry = {
      id: videoId,
      title: title,
      slug: slug,
      description: '',
      category: '',
      tags: [],
      resolution: '4K',
      duration: 0,
      fps: 25,
      prices: { web: 19.99, standard: 19.99, premium: 19.99 },
      thumbnail: R2_BASE + '/thumbs/' + slug + '.jpg',
      r2Key: 'videos/' + slug + '.mp4',
      r2Preview: 'previews/' + slug + '.mp4',
      r2Hover: 'previews/' + slug + '-hover.mp4',
      videoId: 'stockvideo.de-' + Math.random().toString(36).slice(2,10).toUpperCase(),
      featured: false,
      gradient: [{ color: '#1473e6', position: 0 }, { color: '#0d5fcf', position: 100 }]
    };
    admin.videos.unshift(entry);
    localStorage.setItem('adminVideos', JSON.stringify(admin.videos));
    admin.renderVideosList();
  }

  async function uploadOne(file, idx, statusEl, dotEl, barEl) {
    var videoId = String(Date.now() + idx * 17);
    var slug = uniqueSlug(slugFromFile(file.name));
    dotEl.style.background = '#f59e0b';
    statusEl.textContent = 'Verarbeitung laeuft...';
    try {
      await uploadVideo(file, {
        slug: slug,
        videoId: videoId,
        onStatus: function (msg) { statusEl.textContent = msg; },
        onProgress: function (pct) { barEl.style.width = Math.round(pct) + '%'; }
      });
      var title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      addVideoEntry(slug, videoId, title);
      dotEl.style.background = '#22c55e';
      statusEl.textContent = 'Fertig — Metadaten bitte ergaenzen (rote Ampel)';
      barEl.style.width = '100%';
      barEl.style.background = '#22c55e';
    } catch (e) {
      dotEl.style.background = '#ef4444';
      statusEl.textContent = 'Fehler: ' + (e.message || String(e));
    }
  }

  function injectBatchUI() {
    if (document.getElementById('bw-batch-zone')) return;
    var panel = document.getElementById('panel-videos');
    if (!panel) return;

    var listDiv = document.getElementById('videosList');
    var insertParent = listDiv ? listDiv.parentElement : panel;
    var insertBefore = listDiv || insertParent.firstChild;

    var wrap = document.createElement('div');
    wrap.style.marginBottom = '20px';
    wrap.innerHTML =
      '<div id="bw-batch-zone" style="border:2px dashed #3a3a4a;border-radius:10px;padding:24px 20px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:#0f0f1a;">' +
        '<div style="font-size:24px;margin-bottom:6px;">📥</div>' +
        '<div style="font-size:14px;font-weight:600;color:#ccc;margin-bottom:4px;">Videos per Drag & Drop hochladen</div>' +
        '<div style="font-size:12px;color:#555;">Bis zu 10 Videodateien gleichzeitig &middot; klicken zum Auswaehlen</div>' +
        '<input type="file" id="bw-batch-input" accept="video/*" multiple style="display:none;">' +
        '<div id="bw-batch-cards" style="margin-top:14px;display:flex;flex-direction:column;gap:8px;text-align:left;"></div>' +
      '</div>';

    insertParent.insertBefore(wrap, insertBefore);

    var zone  = document.getElementById('bw-batch-zone');
    var input = document.getElementById('bw-batch-input');
    var cards = document.getElementById('bw-batch-cards');

    function handleFiles(files) {
      var arr = Array.from(files).filter(function (f) { return f.type.startsWith('video/'); }).slice(0, 10);
      if (!arr.length) { alert('Bitte nur Videodateien hochladen.'); return; }
      cards.innerHTML = '';
      arr.forEach(function (file, idx) {
        var card = document.createElement('div');
        card.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:12px;';
        var dot = document.createElement('div');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#555;flex-shrink:0;margin-top:4px;';
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var fname = document.createElement('div');
        fname.style.cssText = 'font-size:13px;font-weight:600;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        fname.textContent = file.name;
        var status = document.createElement('div');
        status.style.cssText = 'font-size:11px;color:#777;margin-top:3px;';
        status.textContent = 'Warte...';
        var progWrap = document.createElement('div');
        progWrap.style.cssText = 'height:3px;background:#2a2a3e;border-radius:2px;margin-top:8px;overflow:hidden;';
        var bar = document.createElement('div');
        bar.style.cssText = 'height:100%;width:0%;background:#4f46e5;transition:width .3s;border-radius:2px;';
        progWrap.appendChild(bar);
        info.append(fname, status, progWrap);
        card.append(dot, info);
        cards.appendChild(card);
        uploadOne(file, idx, status, dot, bar);
      });
    }

    zone.addEventListener('click', function (e) { if (e.target !== input) input.click(); });
    input.addEventListener('change', function () { handleFiles(input.files); input.value = ''; });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = '#4f46e5'; zone.style.background = '#0d0d20'; });
    zone.addEventListener('dragleave', function () { zone.style.borderColor = '#3a3a4a'; zone.style.background = '#0f0f1a'; });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.style.borderColor = '#3a3a4a';
      zone.style.background = '#0f0f1a';
      handleFiles(e.dataTransfer.files);
    });
  }

  // ── 6. PANEL SWITCH HOOK ─────────────────────────────────────────
  var _origSwitch = admin.switchPanel.bind(admin);
  admin.switchPanel = function (name) {
    _origSwitch(name);
    if (name === 'videos') {
      setTimeout(function () { injectBatchUI(); injectAmpels(); }, 150);
    }
  };

  // ── 7. MUTATION OBSERVER ─────────────────────────────────────────
  var listEl = document.getElementById('videoListItems');
  if (listEl) {
    new MutationObserver(function () {
      setTimeout(injectAmpels, 80);
    }).observe(listEl, { childList: true });
  }

  // ── 8. INITIALISIERUNG ───────────────────────────────────────────
  if (admin.videos && admin.videos.length) {
    admin.renderVideosList();
  }
  var vpanel = document.getElementById('panel-videos');
  if (vpanel && vpanel.style.display !== 'none') {
    setTimeout(injectBatchUI, 200);
  }

  console.log('[admin-patch] v20260421B geladen');
})();
