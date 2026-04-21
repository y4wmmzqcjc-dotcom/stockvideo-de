// admin-patch.js — v20260421C
(function () {
  'use strict';

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
