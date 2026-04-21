// admin-patch.js — v20260422C
(function () {
  'use strict';
  // ── Modal-Fix CSS
  (function(){var s=document.createElement('style');s.id='bw-patch-css';s.textContent='.modal.active .modal-content{display:block!important}';document.head.appendChild(s);})();

  var R2_BASE = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';

  // ── Helpers
  function isComplete(v) { return !!(v.title && v.title.trim() && v.description && v.description.trim() && v.tags && Array.isArray(v.tags) && v.tags.length > 0 && v.category && v.category.trim()); }
  function getMissing(v) { var m = []; if (!v.title || !v.title.trim()) m.push('Titel'); if (!v.description || !v.description.trim()) m.push('Beschreibung'); if (!v.tags || !v.tags.length) m.push('Schlagwörter'); if (!v.category || !v.category.trim()) m.push('Kategorie'); return m; }
  function wordCount(str) { return (str || '').trim().split(/\s+/).filter(Boolean).length; }

  // ── Unerwünschte UI-Elemente verstecken
  function hideElements() {
    var slugBtn = document.getElementById('optimizeSlugsBtn');
    if (slugBtn) slugBtn.style.display = 'none';
    ['videoModalFeatured', 'videoModalGradients'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var row = el.closest('.form-row, .form-group, .field-row, tr') || el.parentElement;
      if (row) row.style.display = 'none';
    });
    var batchZone = document.getElementById('bw-batch-zone');
    if (batchZone) batchZone.remove();
  }

  // ── Ampel-Indikatoren
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
      dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;flex-shrink:0;vertical-align:middle;background:' + (ok ? '#22c55e' : '#ef4444');
      var titleEl = item.querySelector('.video-title, .video-name, h3, h4, strong') || item.firstChild;
      if (titleEl && titleEl.parentNode) titleEl.parentNode.insertBefore(dot, titleEl);
    });
  }

  // ── Video-Metadaten automatisch erkennen (Dauer + FPS)
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
        vid.play().then(function () { vid.requestVideoFrameCallback(onFrame); }).catch(function () { URL.revokeObjectURL(url); fpsEl.value = 25; });
      } else {
        URL.revokeObjectURL(url);
        fpsEl.value = 25;
      }
    });
    vid.addEventListener('error', function () { URL.revokeObjectURL(url); });
  }
  // Expose for KI-IIFE
  window._bwAutoDetect = autoDetectVideoMeta;

  // ── File-Input Hook (nur Marker, KI-IIFE übernimmt via Capture-Phase)
  function hookFileInput() {
    var fileInput = document.getElementById('videoModalFile');
    if (!fileInput || fileInput._bwHooked) return;
    fileInput._bwHooked = true;
  }

  // ── openVideoModal: Standard-Preis + Hooks
  var _origOpen = admin.openVideoModal.bind(admin);
  admin.openVideoModal = function (video) {
    _origOpen(video);
    setTimeout(function () {
      var priceEl = document.getElementById('videoModalPrice');
      if (priceEl && (!video || !video.price)) priceEl.value = '19.99';
      hookFileInput();
      hideElements();
    }, 60);
  };

  // ── renderVideosList: neueste zuerst + Ampeln
  var _origRender = admin.renderVideosList.bind(admin);
  admin.renderVideosList = function () {
    admin.videos.sort(function (a, b) { return Number(b.id) - Number(a.id); });
    _origRender();
    setTimeout(injectAmpels, 80);
  };

  // ── saveVideo: Ampeln aktualisieren
  var _origSave = admin.saveVideo.bind(admin);
  admin.saveVideo = function () {
    _origSave();
    setTimeout(injectAmpels, 80);
  };

  // ── publishToGitHub: unvollständige Videos herausfiltern
  var _origPublish = admin.publishToGitHub.bind(admin);
  admin.publishToGitHub = function () {
    var raw = localStorage.getItem('adminVideos');
    var all = JSON.parse(raw || '[]');
    var complete = all.filter(isComplete);
    var draftCount = all.length - complete.length;
    if (draftCount > 0) {
      var names = all.filter(function (v) { return !isComplete(v); }).map(function (v) { return v.title || ('[ID: ' + v.id + ']'); });
      var msg = draftCount + ' Video(s) ohne vollständige Metadaten werden NICHT veröffentlicht:\n\n' + names.join('\n') + '\n\nFortfahren?';
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

  // ── switchPanel: Aufräumen + Ampeln
  var _origSwitch = admin.switchPanel.bind(admin);
  admin.switchPanel = function (name) {
    _origSwitch(name);
    if (name === 'videos') {
      setTimeout(function () { hideElements(); injectAmpels(); }, 150);
    }
  };

  // ── MutationObserver
  var listItems = document.getElementById('videoListItems');
  if (listItems) {
    new MutationObserver(function () { setTimeout(injectAmpels, 80); }).observe(listItems, { childList: true });
  }

  // ── Initialer Cleanup
  hideElements();
})();

// v20260422C - KI erst, dann Upload
// Flow: Datei reinziehen -> KI analysiert Frames -> KI befüllt ALLE Felder (inkl. Titel) -> Upload startet automatisch
(function () {
  'use strict';

  window._kiResult = null;
  window._kiStatus = 'idle';

  function setKiUI(msg) {
    var el = document.getElementById('videoModalAlert');
    if (!el) return;
    el.style.cssText = 'display:block;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:13px;';
    if (msg.startsWith('ERR')) { el.style.background = '#fff3cd'; el.style.color = '#856404'; }
    else if (msg.startsWith('OK')) { el.style.background = '#d4edda'; el.style.color = '#155724'; }
    else { el.style.background = '#e8f4fd'; el.style.color = '#0c5460'; }
    el.textContent = msg.replace(/^(ERR|OK|INFO) /, '');
  }

  function extractFramesB64(file, count, cb) {
    var url = URL.createObjectURL(file);
    var vid = document.createElement('video');
    vid.src = url; vid.muted = true; vid.preload = 'metadata';
    var frames = []; var done = 0;
    vid.addEventListener('loadedmetadata', function () {
      var dur = vid.duration || 10;
      for (var i = 0; i < count; i++) {
        (function (idx) {
          var t = dur * (idx + 1) / (count + 1);
          var v2 = document.createElement('video');
          v2.src = url; v2.muted = true; v2.currentTime = t;
          v2.addEventListener('seeked', function () {
            var cv = document.createElement('canvas');
            cv.width = 320; cv.height = 180;
            cv.getContext('2d').drawImage(v2, 0, 0, 320, 180);
            frames[idx] = cv.toDataURL('image/jpeg', 0.7).split(',')[1];
            done++;
            if (done === count) { URL.revokeObjectURL(url); cb(frames); }
          }, { once: true });
        })(i);
      }
    });
    vid.addEventListener('error', function () { URL.revokeObjectURL(url); cb([]); });
  }

  function triggerUpload() {
    var fileEl = document.getElementById('videoModalFile');
    if (!fileEl || !fileEl.files[0]) return;
    if (fileEl._kiCaptureFn) {
      fileEl.removeEventListener('change', fileEl._kiCaptureFn, true);
      fileEl._kiCaptureFn = null;
    }
    fileEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillFromKi() {
    var r = window._kiResult;
    if (!r) { triggerUpload(); return; }
    var titleEl = document.getElementById('videoModalTitle_Input');
    var descEl = document.getElementById('videoModalDescription');
    var catEl = document.getElementById('videoModalCategory');
    var tagsEl = document.getElementById('videoModalTags');
    var priceEl = document.getElementById('videoModalPrice');
    if (titleEl && r.titel) titleEl.value = r.titel;
    if (descEl && r.beschreibung) descEl.value = r.beschreibung;
    if (tagsEl && r.tags) tagsEl.value = Array.isArray(r.tags) ? r.tags.join(', ') : r.tags;
    if (priceEl && r.preis) priceEl.value = r.preis;
    if (catEl && r.kategorie) {
      var kval = r.kategorie.toLowerCase().trim();
      Array.from(catEl.options).forEach(function (o) {
        if (o.value === kval || kval.startsWith(o.value)) catEl.value = o.value;
      });
    }
    setKiUI('OK KI fertig - Felder befüllt, Upload startet...');
    setTimeout(triggerUpload, 600);
  }

  function runKi(file) {
    window._kiStatus = 'running'; window._kiResult = null;
    setKiUI('INFO KI analysiert Video...');
    extractFramesB64(file, 3, function (frames) {
      var prompt = 'Analysiere dieses Stockvideo fuer stockvideo.de. Antworte NUR mit JSON, kein Markdown: ' +
        '{"titel":"Kurzer SEO-Titel auf Deutsch (max. 7 Woerter)",' +
        '"beschreibung":"SEO-optimierte Beschreibung auf Deutsch (2-3 Saetze)",' +
        '"kategorie":"EINE aus: tiere|essen|hobbys|industrie|pflanzen|technologie|drohne|gebaeude|business|transport",' +
        '"tags":["tag1","tag2","tag3","tag4","tag5"],' +
        '"preis":29}';
      fetch('/api/ki-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames: frames, prompt: prompt })
      }).then(function (resp) { return resp.json(); })
      .then(function (data) {
        var parsed = null;
        try {
          var txt = typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis || '{}');
          txt = txt.replace(/^[\s\S]*?(\{)/, '$1').replace(/(\})[\s\S]*$/, '$1');
          parsed = JSON.parse(txt);
        } catch (e) {}
        if (parsed) {
          window._kiResult = parsed; window._kiStatus = 'done'; fillFromKi();
        } else {
          window._kiStatus = 'error';
          var errMsg = data.error ? String(data.error).substring(0, 60) : 'Keine Antwort';
          setKiUI('ERR KI: ' + errMsg + ' - Upload startet trotzdem');
          setTimeout(triggerUpload, 1200);
        }
      }).catch(function (err) {
        window._kiStatus = 'error';
        setKiUI('ERR KI-Fehler: ' + String(err.message).substring(0, 60) + ' - Upload startet trotzdem');
        setTimeout(triggerUpload, 1200);
      });
    });
  }

  function attachCapture() {
    var fileEl = document.getElementById('videoModalFile');
    if (!fileEl || fileEl._kiCaptureFn) return;
    function captureHandler(e) {
      var file = fileEl.files[0];
      if (!file) return;
      e.stopImmediatePropagation();
      if (window._bwAutoDetect) window._bwAutoDetect(file);
      runKi(file);
    }
    fileEl._kiCaptureFn = captureHandler;
    fileEl.addEventListener('change', captureHandler, true);
  }

  if (typeof admin !== 'undefined' && admin.openVideoModal) {
    var _orig = admin.openVideoModal.bind(admin);
    admin.openVideoModal = function () {
      window._kiResult = null; window._kiStatus = 'idle';
      var alertEl = document.getElementById('videoModalAlert');
      if (alertEl) { alertEl.style.display = 'none'; alertEl.textContent = ''; }
      _orig.apply(this, arguments);
      setTimeout(attachCapture, 200);
    };
  }
  attachCapture();
})();
