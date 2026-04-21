// admin-patch.js — v20260421S
(function () {
  'use strict';
  // ── Modal-Fix CSS
  (function(){const s=document.createElement('style');s.id='bw-patch-css';s.textContent='.modal.active .modal-content{display:block!important}';document.head.appendChild(s);})();

  var R2_BASE = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';

  // ── Helpers ─────────────────────────────────────────────────────────────────────────────
  function isComplete(v) {
    return !!(v.title && v.title.trim() && v.description && v.description.trim() &&
      v.tags && Array.isArray(v.tags) && v.tags.length > 0 && v.category && v.category.trim());
  }

  function getMissing(v) {
    var m = [];
    if (!v.title || !v.title.trim()) m.push('Titel');
    if (!v.description || !v.description.trim()) m.push('Beschreibung');
    if (!v.tags || !v.tags.length) m.push('Schlagwörter');
    if (!v.category || !v.category.trim()) m.push('Kategorie');
    return m;
  }

  function wordCount(str) {
    return (str || '').trim().split(/\s+/).filter(Boolean).length;
  }

  // ── Unerwünschte UI-Elemente verstecken ─────────────────────────────────────────────────
  function hideElements() {
    // SEO-Slug Button (gefährlich — benennt R2-Dateien ohne videos.json-Update)
    var slugBtn = document.getElementById('optimizeSlugsBtn');
    if (slugBtn) slugBtn.style.display = 'none';

    // Featured + Gradients aus Video-Modal entfernen
    ['videoModalFeatured', 'videoModalGradients'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var row = el.closest('.form-row, .form-group, .field-row, tr') || el.parentElement;
      if (row) row.style.display = 'none';
    });

    // Batch-Zone entfernen falls noch vorhanden
    var batchZone = document.getElementById('bw-batch-zone');
    if (batchZone) batchZone.remove();
  }

  // ── Ampel-Indikatoren ────────────────────────────────────────────────────────────────────
  function injectAmpels() {
    document.querySelectorAll('#videoListItems .video-item').forEach(function (item) {
      if (item.querySelector('.bw-ampel')) return;
      var id = item.dataset.id;
      if (!id) return;
      var v = admin.videos.find(function (x) { return String(x.id) === String(id); });
      if (!v) return;
      var ok = isComplete(v);
      var dot = document.createElement('span');
      dot.className = 'bw-ampel';
      dot.title = ok ? 'Alle Metadaten vollständig' : 'Fehlt: ' + getMissing(v).join(', ');
      dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;' +
        'margin-right:6px;flex-shrink:0;vertical-align:middle;background:' + (ok ? '#22c55e' : '#ef4444');
      var titleEl = item.querySelector('.video-title, .video-name, h3, h4, strong') || item.firstChild;
      if (titleEl && titleEl.parentNode) titleEl.parentNode.insertBefore(dot, titleEl);
    });
  }

  // ── Video-Metadaten automatisch erkennen (Dauer + FPS) ──────────────────────────
  function autoDetectVideoMeta(file) {
    var url = URL.createObjectURL(file);
    var vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.muted = true;
    vid.playsInline = true;
    vid.src = url;

    vid.addEventListener('loadedmetadata', function () {
      var durEl = document.getElementById('videoModalDuration');
      if (durEl) durEl.value = Math.round(vid.duration);

      var fpsEl = document.getElementById('videoModalFPS');
      if (!fpsEl) { URL.revokeObjectURL(url); return; }

      // FPS via requestVideoFrameCallback (modernes API)
      if (typeof vid.requestVideoFrameCallback === 'function') {
        var times = [];
        function onFrame(now, meta) {
          times.push(meta.mediaTime);
          if (times.length < 30 && vid.currentTime < 1.5) {
            vid.requestVideoFrameCallback(onFrame);
          } else {
            vid.pause();
            URL.revokeObjectURL(url);
            if (times.length >= 4) {
              var diffs = [];
              for (var i = 1; i < times.length; i++) diffs.push(times[i] - times[i - 1]);
              var avg = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length;
              var fps = Math.round(1 / avg);
              var common = [24, 25, 30, 48, 50, 60, 120];
              var closest = common.reduce(function (a, b) { return Math.abs(b - fps) < Math.abs(a - fps) ? b : a; });
              fpsEl.value = closest;
            } else {
              fpsEl.value = 25;
            }
          }
        }
        vid.currentTime = 0.01;
        vid.play().then(function () {
          vid.requestVideoFrameCallback(onFrame);
        }).catch(function () {
          URL.revokeObjectURL(url);
          fpsEl.value = 25;
        });
      } else {
        URL.revokeObjectURL(url);
        fpsEl.value = 25;
      }
    });

    vid.addEventListener('error', function () {
      URL.revokeObjectURL(url);
    });
  }

  // ── File-Input: Titel prüfen + Auto-Detect ───────────────────────────────────────────────
  function hookFileInput() {
    var fileInput = document.getElementById('videoModalFile');
    if (!fileInput || fileInput._bwHooked) return;
    fileInput._bwHooked = true;

    fileInput.addEventListener('change', function (e) {
      var titleEl = document.getElementById('videoModalTitle_Input');
      var title = titleEl ? titleEl.value.trim() : '';
      var wc = wordCount(title);
      if (wc < 5) {
        var needed = 5 - wc;
        alert('Bitte zuerst einen Titel mit mindestens 5 Wörtern eingeben.\n' +
          (wc === 0 ? 'Noch kein Titel eingetragen.' : 'Noch ' + needed + ' Wort' + (needed === 1 ? '' : 'örter') + ' fehlen.'));
        fileInput.value = '';
        return;
      }
      var file = e.target.files[0];
      if (file) autoDetectVideoMeta(file);
    });
  }

  // ── openVideoModal: Standard-Preis + Hooks ──────────────────────────────────────────────
  var _origOpen = admin.openVideoModal.bind(admin);
  admin.openVideoModal = function (video) {
    _origOpen(video);
    setTimeout(function () {
      // Standard-Preis 19.99 für neue Videos
      var priceEl = document.getElementById('videoModalPrice');
      if (priceEl && (!video || !video.price)) priceEl.value = '19.99';
      hookFileInput();
      hideElements();
    }, 60);
  };

  // ── renderVideosList: neueste zuerst + Ampeln ─────────────────────────────────────────────
  var _origRender = admin.renderVideosList.bind(admin);
  admin.renderVideosList = function () {
    admin.videos.sort(function (a, b) { return Number(b.id) - Number(a.id); });
    _origRender();
    setTimeout(injectAmpels, 80);
  };

  // ── saveVideo: Ampeln aktualisieren ───────────────────────────────────────────────────────
  var _origSave = admin.saveVideo.bind(admin);
  admin.saveVideo = function () {
    _origSave();
    setTimeout(injectAmpels, 80);
  };

  // ── publishToGitHub: unvollständige Videos herausfiltern ─────────────────────────────────
  var _origPublish = admin.publishToGitHub.bind(admin);
  admin.publishToGitHub = function () {
    var raw = localStorage.getItem('adminVideos');
    var all = JSON.parse(raw || '[]');
    var complete = all.filter(isComplete);
    var draftCount = all.length - complete.length;
    if (draftCount > 0) {
      var names = all.filter(function (v) { return !isComplete(v); }).map(function (v) { return v.title || ('[ID: ' + v.id + ']'); });
      var msg = draftCount + ' Video(s) ohne vollständige Metadaten werden NICHT veröffentlicht:\n\n' +
        names.join('\n') + '\n\nFortfahren?';
      if (!confirm(msg)) return;
      localStorage.setItem('adminVideos', JSON.stringify(complete));
    }
    var result = _origPublish();
    if (draftCount > 0) {
      var restore = function () { localStorage.setItem('adminVideos', raw); };
      if (result && result.then) { result.then(restore, restore); } else { setTimeout(restore, 8000); }
    }
    return result;
  };

  // ── switchPanel: Aufräumen + Ampeln ──────────────────────────────────────────────────────────────
  var _origSwitch = admin.switchPanel.bind(admin);
  admin.switchPanel = function (name) {
    _origSwitch(name);
    if (name === 'videos') {
      setTimeout(function () { hideElements(); injectAmpels(); }, 150);
    }
  };

  // ── MutationObserver ──────────────────────────────────────────────────────────────────────────────
  var listItems = document.getElementById('videoListItems');
  if (listItems) {
    new MutationObserver(function () { setTimeout(injectAmpels, 80); }).observe(listItems, { childList: true });
  }

  // ── Initialer Cleanup ───────────────────────────────────────────────────────────────────────────
  hideElements();

})();



// v20260422A - KI: Analyse beim File-Select, Title-Blur befüllt Felder
// Flow: Datei wählen → KI analysiert Frames → User tippt Titel → Tab/Enter → Felder werden befüllt
(function () {
  'use strict';

  window._kiResult = null;
  window._kiStatus = 'idle'; // idle | running | done | error

  // ── Status-Anzeige im Modal ───────────────────────────────────────────
  function setKiUI(msg) {
    const el = document.getElementById('videoModalAlert');
    if (!el) return;
    el.style.cssText = 'display:block;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:13px;';
    if (msg.startsWith('ERR')) {
      el.style.background = '#fff3cd'; el.style.color = '#856404';
    } else if (msg.startsWith('OK')) {
      el.style.background = '#d4edda'; el.style.color = '#155724';
    } else {
      el.style.background = '#e8f4fd'; el.style.color = '#0c5460';
    }
    el.textContent = msg.replace(/^(ERR|OK|INFO) /, '');
  }

  // ── Frames aus Video-Datei extrahieren ───────────────────────────────
  async function extractFramesB64(file, count) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.src = url; vid.muted = true; vid.preload = 'metadata';
      const frames = [];
      vid.addEventListener('loadedmetadata', async () => {
        const dur = vid.duration || 10;
        for (let i = 0; i < count; i++) {
          const t = dur * (i + 1) / (count + 1);
          await new Promise(r => {
            vid.currentTime = t;
            vid.addEventListener('seeked', () => {
              const cv = document.createElement('canvas');
              cv.width = 320; cv.height = 180;
              cv.getContext('2d').drawImage(vid, 0, 0, 320, 180);
              frames.push(cv.toDataURL('image/jpeg', 0.7).split(',')[1]);
              r();
            }, { once: true });
          });
        }
        URL.revokeObjectURL(url);
        resolve(frames);
      });
      vid.addEventListener('error', () => { URL.revokeObjectURL(url); resolve([]); });
    });
  }

  // ── KI-Analyse aufrufen ───────────────────────────────────────────────
  async function runKiAnalysis(file) {
    window._kiStatus = 'running';
    window._kiResult = null;
    setKiUI('INFO Analysiere Video mit KI...');
    try {
      const frames = await extractFramesB64(file, 3);
      const prompt = 'Analysiere dieses Stockvideo fuer stockvideo.de. ' +
        'Antworte NUR mit JSON, kein Markdown: ' +
        '{"beschreibung":"SEO-optimierte Beschreibung auf Deutsch (2-3 Saetze)",' +
        '"kategorie":"EINE aus: tiere|essen|hobbys|industrie|pflanzen|technologie|drohne|gebaeude|business|transport",' +
        '"tags":["tag1","tag2","tag3","tag4","tag5"],' +
        '"preis":29,"dauer_sek":0,"fps":0}';
      const resp = await fetch('/api/ki-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, prompt })
      });
      const data = await resp.json();
      if (data.analysis) {
        let parsed = null;
        try {
          let txt = typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis);
          txt = txt.replace(/^[sS]*?({)/, '$1').replace(/(})[sS]*$/, '$1');
          parsed = JSON.parse(txt);
        } catch (e) { /* ignore parse error */ }
        if (parsed) {
          window._kiResult = parsed;
          window._kiStatus = 'done';
          setKiUI('OK KI fertig — Titel eingeben und Tab/Enter druecken');
          return;
        }
      }
      window._kiStatus = 'error';
      const errMsg = data.error ? data.error.replace('Gemini ', '') : 'Kein Ergebnis';
      setKiUI('ERR KI: ' + errMsg + ' — Felder manuell ausfüllen');
    } catch (err) {
      window._kiStatus = 'error';
      setKiUI('ERR KI-Fehler: ' + err.message + ' — Felder manuell ausfüllen');
    }
  }

  // ── Felder aus KI-Ergebnis befüllen ───────────────────────────────
  function fillFromKi() {
    const r = window._kiResult;
    if (!r || window._kiStatus !== 'done') return;
    const get = id => document.getElementById(id);
    const desc  = get('videoModalDescription');
    const cat   = get('videoModalCategory');
    const tags  = get('videoModalTags');
    const dur   = get('videoModalDuration');
    const fps   = get('videoModalFPS');
    const price = get('videoModalPrice');
    if (desc  && !desc.value  && r.beschreibung) desc.value  = r.beschreibung;
    if (tags  && !tags.value  && r.tags)         tags.value  = Array.isArray(r.tags) ? r.tags.join(', ') : r.tags;
    if (dur   && !dur.value   && r.dauer_sek)    dur.value   = r.dauer_sek;
    if (fps   && !fps.value   && r.fps)          fps.value   = r.fps;
    if (price && !price.value && r.preis)        price.value = r.preis;
    if (cat && !cat.value && r.kategorie) {
      const v = r.kategorie.toLowerCase().trim();
      Array.from(cat.options).forEach(o => { if (o.value === v || v.startsWith(o.value)) cat.value = o.value; });
    }
    setKiUI('OK Felder befüllt — bitte prüfen und ggf. anpassen');
  }

  // ── Listener am File-Input und Titel-Input ─────────────────────────
  function attachListeners() {
    const fileEl  = document.getElementById('videoModalFile');
    const titleEl = document.getElementById('videoModalTitle_Input');
    if (fileEl && !fileEl._kiAttached) {
      fileEl._kiAttached = true;
      fileEl.addEventListener('change', function () {
        if (this.files[0]) { window._kiResult = null; window._kiStatus = 'idle'; runKiAnalysis(this.files[0]); }
      });
    }
    if (titleEl && !titleEl._kiTitleAttached) {
      titleEl._kiTitleAttached = true;
      titleEl.addEventListener('blur', function () {
        if (this.value.trim().length > 1 && window._kiStatus === 'done') fillFromKi();
      });
      titleEl.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === 'Tab') && this.value.trim().length > 1 && window._kiStatus === 'done') fillFromKi();
      });
    }
  }

  // ── openVideoModal patchen ────────────────────────────────────────────
  if (typeof admin !== 'undefined' && admin.openVideoModal) {
    const _orig = admin.openVideoModal.bind(admin);
    admin.openVideoModal = function () {
      window._kiResult = null;
      window._kiStatus = 'idle';
      const alertEl = document.getElementById('videoModalAlert');
      if (alertEl) { alertEl.style.display = 'none'; alertEl.textContent = ''; }
      _orig.apply(this, arguments);
      setTimeout(attachListeners, 150);
    };
  }

  attachListeners();

})();
