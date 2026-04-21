// admin-patch.js â v20260421H
(function () {
  'use strict';
  // ââ Modal-Fix CSS
  (function(){const s=document.createElement('style');s.id='bw-patch-css';s.textContent='.modal.active .modal-content{display:block!important}';document.head.appendChild(s);})();

  var R2_BASE = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';

  // ââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function isComplete(v) {
    return !!(v.title && v.title.trim() && v.description && v.description.trim() &&
      v.tags && Array.isArray(v.tags) && v.tags.length > 0 && v.category && v.category.trim());
  }

  function getMissing(v) {
    var m = [];
    if (!v.title || !v.title.trim()) m.push('Titel');
    if (!v.description || !v.description.trim()) m.push('Beschreibung');
    if (!v.tags || !v.tags.length) m.push('SchlagwÃ¶rter');
    if (!v.category || !v.category.trim()) m.push('Kategorie');
    return m;
  }

  function wordCount(str) {
    return (str || '').trim().split(/\s+/).filter(Boolean).length;
  }

  // ââ UnerwÃ¼nschte UI-Elemente verstecken âââââââââââââââââââââââââââââââââââââââââââââââââ
  function hideElements() {
    // SEO-Slug Button (gefÃ¤hrlich â benennt R2-Dateien ohne videos.json-Update)
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

  // ââ Ampel-Indikatoren ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
      dot.title = ok ? 'Alle Metadaten vollstÃ¤ndig' : 'Fehlt: ' + getMissing(v).join(', ');
      dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;' +
        'margin-right:6px;flex-shrink:0;vertical-align:middle;background:' + (ok ? '#22c55e' : '#ef4444');
      var titleEl = item.querySelector('.video-title, .video-name, h3, h4, strong') || item.firstChild;
      if (titleEl && titleEl.parentNode) titleEl.parentNode.insertBefore(dot, titleEl);
    });
  }

  // ââ Video-Metadaten automatisch erkennen (Dauer + FPS) ââââââââââââââââââââââââââ
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

  // ââ File-Input: Titel prÃ¼fen + Auto-Detect âââââââââââââââââââââââââââââââââââââââââââââââ
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
        alert('Bitte zuerst einen Titel mit mindestens 5 WÃ¶rtern eingeben.\n' +
          (wc === 0 ? 'Noch kein Titel eingetragen.' : 'Noch ' + needed + ' Wort' + (needed === 1 ? '' : 'Ã¶rter') + ' fehlen.'));
        fileInput.value = '';
        return;
      }
      var file = e.target.files[0];
      if (file) autoDetectVideoMeta(file);
    });
  }

  // ââ openVideoModal: Standard-Preis + Hooks ââââââââââââââââââââââââââââââââââââââââââââââ
  var _origOpen = admin.openVideoModal.bind(admin);
  admin.openVideoModal = function (video) {
    _origOpen(video);
    setTimeout(function () {
      // Standard-Preis 19.99 fÃ¼r neue Videos
      var priceEl = document.getElementById('videoModalPrice');
      if (priceEl && (!video || !video.price)) priceEl.value = '19.99';
      hookFileInput();
      hideElements();
    }, 60);
  };

  // ââ renderVideosList: neueste zuerst + Ampeln âââââââââââââââââââââââââââââââââââââââââââââ
  var _origRender = admin.renderVideosList.bind(admin);
  admin.renderVideosList = function () {
    admin.videos.sort(function (a, b) { return Number(b.id) - Number(a.id); });
    _origRender();
    setTimeout(injectAmpels, 80);
  };

  // ââ saveVideo: Ampeln aktualisieren âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  var _origSave = admin.saveVideo.bind(admin);
  admin.saveVideo = function () {
    _origSave();
    setTimeout(injectAmpels, 80);
  };

  // ââ publishToGitHub: unvollstÃ¤ndige Videos herausfiltern âââââââââââââââââââââââââââââââââ
  var _origPublish = admin.publishToGitHub.bind(admin);
  admin.publishToGitHub = function () {
    var raw = localStorage.getItem('adminVideos');
    var all = JSON.parse(raw || '[]');
    var complete = all.filter(isComplete);
    var draftCount = all.length - complete.length;
    if (draftCount > 0) {
      var names = all.filter(function (v) { return !isComplete(v); }).map(function (v) { return v.title || ('[ID: ' + v.id + ']'); });
      var msg = draftCount + ' Video(s) ohne vollstÃ¤ndige Metadaten werden NICHT verÃ¶ffentlicht:\n\n' +
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

  // ââ switchPanel: AufrÃ¤umen + Ampeln ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  var _origSwitch = admin.switchPanel.bind(admin);
  admin.switchPanel = function (name) {
    _origSwitch(name);
    if (name === 'videos') {
      setTimeout(function () { hideElements(); injectAmpels(); }, 150);
    }
  };

  // ââ MutationObserver ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  var listItems = document.getElementById('videoListItems');
  if (listItems) {
    new MutationObserver(function () { setTimeout(injectAmpels, 80); }).observe(listItems, { childList: true });
  }

  // ââ Initialer Cleanup âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  hideElements();

})();


// ââ // ── KI-Analyse mit SmolVLM (lokal, kein API-Key) ───────────────────────────────────
(function() {

const MODEL_ID = 'HuggingFaceTB/SmolVLM-256M-Instruct';
const CDN_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js';
const KI_PROMPT = 'Du analysierst ein Standbild aus einem Stockvideo. Antworte NUR mit folgendem JSON, ohne Erklärungen:\n{"titel":"...","beschreibung":"...","keywords":["..."],"kategorie":"..."}\n- titel: kurz, 3-8 Wörter\n- beschreibung: 1-2 Sätze\n- keywords: 5-10 relevante Schlagwörter\n- kategorie: genau einer von: natur, architektur, menschen, transport, technologie, sport, essen, tiere, sonstiges';

// Frame aus Video extrahieren
function extractFrame(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.addEventListener('loadeddata', () => { video.currentTime = Math.min(1, video.duration * 0.1); });
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      const maxW = 512;
      const scale = Math.min(1, maxW / (video.videoWidth || 512));
      canvas.width = Math.round((video.videoWidth || 512) * scale);
      canvas.height = Math.round((video.videoHeight || 288) * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    });
    video.addEventListener('error', () => { URL.revokeObjectURL(url); reject(new Error('Video konnte nicht geladen werden')); });
    video.load();
  });
}

// Status-Element ermitteln/erstellen
function getStatusEl() {
  let el = document.getElementById('ki-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ki-status';
    el.style.cssText = 'margin-top:8px;font-size:13px;color:#888;min-height:18px;';
    const modal = document.querySelector('.modal.active .modal-content') || document.querySelector('#videoUploadModal .modal-content') || document.querySelector('#videoModal .modal-content');
    if (modal) modal.appendChild(el); else document.body.appendChild(el);
  }
  return el;
}

// Hauptfunktion: Frame analysieren und Felder befüllen
async function runAnalysis(file) {
  const setStatus = msg => { const el = getStatusEl(); if (el) el.textContent = msg; };
  try {
    setStatus('⏳ Frame extrahieren...');
    const frame = await extractFrame(file);

    if (!window._kiProcessor || !window._kiModel) {
      setStatus('⏳ KI-Modell laden (~250 MB, einmalig)...');
      const lib = await import(CDN_URL);
      const { AutoProcessor, AutoModelForVision2Seq, RawImage } = lib;
      window._RawImage = RawImage;
      const device = (navigator.gpu) ? 'webgpu' : 'wasm';
      const dtype = (device === 'webgpu')
        ? { embed_tokens: 'fp16', vision_encoder: 'q4', decoder_model_merged: 'q4' }
        : { embed_tokens: 'fp32', vision_encoder: 'fp32', decoder_model_merged: 'q8' };
      window._kiProcessor = await AutoProcessor.from_pretrained(MODEL_ID);
      window._kiModel = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, { device, dtype });
    }

    setStatus('⏳ KI analysiert...');
    const processor = window._kiProcessor;
    const model = window._kiModel;
    const RawImage = window._RawImage;

    const image = await RawImage.fromURL(frame);
    const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: KI_PROMPT }] }];
    const text = processor.apply_chat_template(messages, { add_generation_prompt: true });
    const inputs = await processor(text, [image]);
    const outputIds = await model.generate({ ...inputs, max_new_tokens: 800, do_sample: false });
    const trimmedIds = outputIds.map((ids, i) => ids.slice(inputs.input_ids[i].length));
    const raw = processor.batch_decode(trimmedIds, { skip_special_tokens: true })[0] || '';

    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('Kein JSON: ' + raw.slice(0, 120));
    const data = JSON.parse(jsonMatch[0]);

    const ti = document.querySelector('#videoModalTitle_Input');
    const de = document.querySelector('#videoModalDescription_Input') || document.querySelector('textarea[placeholder*="Beschreibung"]');
    const kw = document.querySelector('#videoModalKeywords_Input') || document.querySelector('input[placeholder*="eyword"]');
    const ca = document.querySelector('#videoModalCategory_Input') || document.querySelector('select');

    if (ti) { ti.value = data.titel || ''; ti.dispatchEvent(new Event('input', { bubbles: true })); }
    if (de) { de.value = data.beschreibung || ''; de.dispatchEvent(new Event('input', { bubbles: true })); }
    if (kw) { kw.value = (data.keywords || []).join(', '); kw.dispatchEvent(new Event('input', { bubbles: true })); }
    if (ca && data.kategorie) {
      const opts = Array.from(ca.options || []);
      const best = opts.find(o =>
        o.value.toLowerCase().includes(data.kategorie.toLowerCase()) ||
        o.textContent.toLowerCase().includes(data.kategorie.toLowerCase())
      );
      if (best) { ca.value = best.value; ca.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    setStatus('\u2705 KI-Analyse abgeschlossen');
  } catch (err) {
    console.error('[KI-Analyse]', err);
    setStatus('\u274c Fehler: ' + err.message);
    const ti = document.querySelector('#videoModalTitle_Input');
    if (ti && ti.value.startsWith('\u23f3')) { ti.value = ''; ti.dispatchEvent(new Event('input', { bubbles: true })); }
  }
}

// File-Input hooken
function hookFileInput(input) {
  input.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (file && file.type.startsWith('video/')) {
      const ti = document.querySelector('#videoModalTitle_Input');
      if (ti && !ti.value.trim()) {
        ti.value = '\u23f3 KI analysiert...';
        ti.dispatchEvent(new Event('input', { bubbles: true }));
      }
      runAnalysis(file);
    }
  });
}

document.querySelectorAll('input[accept*="video"]').forEach(hookFileInput);

})();