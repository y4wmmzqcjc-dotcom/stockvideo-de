/* ============================================================
   admin-articles.js \u2014 Wissen/Artikel-Verwaltung für stockvideo.de
   Version 2.0 \u2014 Listenansicht, Publish/Draft, Planungskalender
   ============================================================ */

window.adminArticles = {
  articles: [],
  currentEditId: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),

  /* ---------- INIT ---------- */
  init() {
    const container = document.getElementById('panel-articles');
    if (!container) return;
    // Always fetch from server, use localStorage only if article count matches
    const stored = localStorage.getItem('adminArticles');
    let localArticles = [];
    if (stored) {
      try { localArticles = JSON.parse(stored); } catch(e) { localArticles = []; }
    }
    fetch('/data/articles.json?t=' + Date.now())
      .then(r => r.json())
      .catch(() => [])
      .then(serverData => {
        const server = serverData || [];
        if (localArticles.length > 0 && localArticles.length === server.length) {
          // Same count: use localStorage (may have unsaved edits)
          this.articles = localArticles;
        } else if (server.length > 0) {
          // Server has different count: sync from server
          this.articles = server;
          localStorage.setItem('adminArticles', JSON.stringify(server));
          if (localArticles.length > 0) {
            console.log('Articles resynced: ' + server.length + ' (was ' + localArticles.length + ')');
          }
        } else if (localArticles.length > 0) {
          // Server empty but local has data: keep local
          this.articles = localArticles;
        } else {
          this.articles = [];
        }
        this._ensureStatusFields();
        this.renderList();
      });
  },

  _ensureStatusFields() {
    this.articles.forEach(a => {
      if (!a.status) a.status = 'published';
      if (!a.scheduledDate) a.scheduledDate = null;
    });
  },

  _save() {
    localStorage.setItem('adminArticles', JSON.stringify(this.articles));
  },

  /* ---------- LIST VIEW ---------- */
  renderList() {
    const c = document.getElementById('panel-articles');
    if (!c) return;

    const published = this.articles.filter(a => a.status === 'published').length;
    const drafts = this.articles.filter(a => a.status === 'draft').length;
    const scheduled = this.articles.filter(a => a.status === 'scheduled').length;

    c.innerHTML = `
      <div class="aa-header">
        <div class="aa-header-top">
          <h2>Wissen / Artikel</h2>
          <button class="aa-btn aa-btn-primary" onclick="adminArticles.newArticle()">+ Neuer Artikel</button>
        </div>
        <div class="aa-stats">
          <div class="aa-stat"><span class="aa-stat-num">${this.articles.length}</span><span class="aa-stat-label">Gesamt</span></div>
          <div class="aa-stat aa-stat-green"><span class="aa-stat-num">${published}</span><span class="aa-stat-label">\u00d6ffentlich</span></div>
          <div class="aa-stat aa-stat-yellow"><span class="aa-stat-num">${scheduled}</span><span class="aa-stat-label">Geplant</span></div>
          <div class="aa-stat aa-stat-gray"><span class="aa-stat-num">${drafts}</span><span class="aa-stat-label">Entwurf</span></div>
        </div>
      </div>

      <div class="aa-layout">
        <div class="aa-list-section">
          <div class="aa-filter-bar">
            <button class="aa-filter active" data-filter="all" onclick="adminArticles.filterList('all',this)">Alle</button>
            <button class="aa-filter" data-filter="published" onclick="adminArticles.filterList('published',this)">\u00d6ffentlich</button>
            <button class="aa-filter" data-filter="scheduled" onclick="adminArticles.filterList('scheduled',this)">Geplant</button>
            <button class="aa-filter" data-filter="draft" onclick="adminArticles.filterList('draft',this)">Entwurf</button>
          </div>
          <div class="aa-article-list" id="aa-article-list">
            ${this._renderArticleRows('all')}
          </div>
        </div>

        
      <div class="aa-actions-bottom">
        <button class="aa-btn aa-btn-save" onclick="adminArticles.publishToGitHub()">Alle \u00c4nderungen veröffentlichen</button>
      </div>
    `;
  },

  _getSeoChecks(a) {
    return [
      { key: 'keyphrase', label: 'Keyphrase', ok: !!(a.keyphrase && a.keyphrase.trim()) },
      { key: 'title', label: 'SEO-Titel', ok: !!(a.seoTitle && a.seoTitle.length >= 30 && a.seoTitle.length <= 70) },
      { key: 'desc', label: 'Meta-Beschreibung', ok: !!(a.metaDescription && a.metaDescription.length >= 80 && a.metaDescription.length <= 170) },
      { key: 'links', label: 'Interne Links', ok: !!(a.internalLinks && a.internalLinks.length > 0) },
      { key: 'wiki', label: 'Wikipedia', ok: !!(a.wikipediaUrl && a.wikipediaUrl.trim()) }
    ];
  },

  _getSeoScore(a) {
    const checks = this._getSeoChecks(a);
    const score = checks.filter(c => c.ok).length;
    if (score >= 4) return 'green';
    if (score >= 2) return 'yellow';
    return 'red';
  },

  _renderSeoIcons(a) {
    const checks = this._getSeoChecks(a);
    return checks.map(c => 
      '<span class="aa-seo-icon ' + (c.ok ? 'aa-seo-ok' : 'aa-seo-miss') + '" title="' + c.label + ': ' + (c.ok ? 'OK' : 'Fehlt') + '">' + (c.ok ? '\u2713' : '\u2717') + '</span>'
    ).join('');
  },

  _getSeoLabel(color) {
    if (color === 'green') return 'SEO gut';
    if (color === 'yellow') return 'SEO teilweise';
    return 'SEO fehlt';
  },

  _renderArticleRows(filter) {
    let list = this.articles;
    if (filter !== 'all') list = list.filter(a => a.status === filter);
    if (!list.length) return '<div class="aa-empty">Keine Artikel in dieser Kategorie</div>';

    return list.map(a => {
      const statusClass = a.status === 'published' ? 'aa-status-published' : a.status === 'scheduled' ? 'aa-status-scheduled' : 'aa-status-draft';
      const statusLabel = a.status === 'published' ? '\u00d6ffentlich' : a.status === 'scheduled' ? 'Geplant' : 'Entwurf';
      const statusIcon = a.status === 'published' ? '\u25CF' : a.status === 'scheduled' ? '\u25D0' : '\u25CB';
      const schedInfo = a.status === 'scheduled' && a.scheduledDate ? `<span class="aa-sched-date">${this._formatDate(a.scheduledDate)}</span>` : '';
      const catColor = a.categoryColor || '#1473e6';

      return `
        <div class="aa-row" data-status="${a.status}" data-id="${a.id}">
          <div class="aa-row-status">
            <span class="${statusClass}" title="${statusLabel}">${statusIcon}</span>
          </div>
          <div class="aa-row-info">
            <div class="aa-row-title">${a.title || a.seoTitle || 'Ohne Titel'}</div>
            <div class="aa-row-meta">
              <span class="aa-cat-badge" style="background:${catColor}">${a.category}</span>
              <span>${a.readTime || '?'} Min.</span>
              ${schedInfo}
            </div>
          </div>
          <div class="aa-row-actions">
            <div class="aa-seo-badges">${this._renderSeoIcons(a)}</div>
            <label class="aa-toggle" title="\u00d6ffentlich / Entwurf">
              <input type="checkbox" ${a.status === 'published' ? 'checked' : ''} onchange="adminArticles.toggleStatus('${a.id}', this.checked)">
              <span class="aa-toggle-slider"></span>
            </label>
            <button class="aa-btn-icon" title="Planen" onclick="adminArticles.openScheduler('${a.id}')">\uD83D\uDCC5</button>
            <button class="aa-btn-icon" title="Bearbeiten" onclick="adminArticles.openEditor('${a.id}')">\u270F\uFE0F</button>
            <button class="aa-btn-icon aa-btn-danger" title="Löschen" onclick="adminArticles.deleteArticle('${a.id}')">\uD83D\uDDD1\uFE0F</button>
          </div>
        </div>`;
    }).join('');
  },

  filterList(filter, btn) {
    document.querySelectorAll('.aa-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('aa-article-list').innerHTML = this._renderArticleRows(filter);
  },

  /* ---------- STATUS TOGGLE ---------- */
  toggleStatus(id, isPublished) {
    const a = this.articles.find(x => x.id == id);
    if (!a) return;
    a.status = isPublished ? 'published' : 'draft';
    if (isPublished) a.scheduledDate = null;
    this._save();
    this.renderList();
  },

  /* ---------- SCHEDULER ---------- */
  openScheduler(id) {
    const a = this.articles.find(x => x.id == id);
    if (!a) return;
    const current = a.scheduledDate || '';
    const overlay = document.createElement('div');
    overlay.className = 'aa-overlay';
    overlay.innerHTML = `
      <div class="aa-modal">
        <h3>Veröffentlichung planen</h3>
        <p class="aa-modal-title">${a.title || a.seoTitle}</p>
        <div class="aa-modal-field">
          <label>Veröffentlichungsdatum:</label>
          <input type="date" id="aa-sched-input" value="${current}" min="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="aa-modal-field">
          <label>Uhrzeit:</label>
          <input type="time" id="aa-sched-time" value="09:00">
        </div>
        <div class="aa-modal-actions">
          <button class="aa-btn" onclick="this.closest('.aa-overlay').remove()">Abbrechen</button>
          <button class="aa-btn aa-btn-primary" onclick="adminArticles.setSchedule('${id}')">Planen</button>
          ${a.status === 'scheduled' ? '<button class="aa-btn aa-btn-danger" onclick="adminArticles.removeSchedule(\'' + id + '\')">Planung entfernen</button>' : ''}
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  setSchedule(id) {
    const a = this.articles.find(x => x.id == id);
    if (!a) return;
    const dateVal = document.getElementById('aa-sched-input').value;
    if (!dateVal) { alert('Bitte Datum wählen'); return; }
    a.scheduledDate = dateVal;
    a.status = 'scheduled';
    this._save();
    document.querySelector('.aa-overlay')?.remove();
    this.renderList();
  },

  removeSchedule(id) {
    const a = this.articles.find(x => x.id == id);
    if (!a) return;
    a.scheduledDate = null;
    a.status = 'draft';
    this._save();
    document.querySelector('.aa-overlay')?.remove();
    this.renderList();
  },

  /* ---------- CALENDAR ---------- */
  _monthName(m) {
    return ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][m];
  },

  _formatDate(d) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  _renderCalendar() {
    const y = this.calendarYear, m = this.calendarMonth;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    let startDay = first.getDay() || 7; // Monday = 1
    const days = last.getDate();
    const today = new Date().toISOString().split('T')[0];

    // Get articles with dates in this month
    const monthArticles = {};
    this.articles.forEach(a => {
      const d = a.scheduledDate || (a.status === 'published' ? (a.publishDate || null) : null);
      if (d && d.startsWith(y + '-' + String(m+1).padStart(2,'0'))) {
        const day = parseInt(d.split('-')[2]);
        if (!monthArticles[day]) monthArticles[day] = [];
        monthArticles[day].push(a);
      }
    });

    let html = '<div class="aa-cal-grid">';
    html += ['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => `<div class="aa-cal-head">${d}</div>`).join('');

    // Empty cells before first day
    for (let i = 1; i < startDay; i++) html += '<div class="aa-cal-cell aa-cal-empty"></div>';

    for (let d = 1; d <= days; d++) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === today;
      const arts = monthArticles[d];
      let dots = '';
      if (arts) {
        dots = arts.map(a => `<span class="aa-cal-dot ${a.status === 'published' ? 'aa-dot-green' : 'aa-dot-yellow'}" title="${a.title || a.seoTitle}"></span>`).join('');
      }
      html += `<div class="aa-cal-cell${isToday ? ' aa-cal-today' : ''}${arts ? ' aa-cal-has-art' : ''}" data-date="${dateStr}">
        <span class="aa-cal-day">${d}</span>
        <div class="aa-cal-dots">${dots}</div>
      </div>`;
    }
    html += '</div>';
    return html;
  },

  _renderUpcoming() {
    const now = new Date().toISOString().split('T')[0];
    const upcoming = this.articles
      .filter(a => a.status === 'scheduled' && a.scheduledDate && a.scheduledDate >= now)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .slice(0, 5);
    if (!upcoming.length) return '<div class="aa-upcoming-empty">Keine geplanten Artikel</div>';
    return '<h4>Nächste geplante Artikel</h4>' + upcoming.map(a => `
      <div class="aa-upcoming-item">
        <span class="aa-upcoming-date">${this._formatDate(a.scheduledDate)}</span>
        <span class="aa-upcoming-title">${a.title || a.seoTitle}</span>
      </div>`).join('');
  },

  calPrev() {
    this.calendarMonth--;
    if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear--; }
    document.getElementById('aa-cal-title').textContent = this._monthName(this.calendarMonth) + ' ' + this.calendarYear;
    document.getElementById('aa-calendar').innerHTML = this._renderCalendar();
  },

  calNext() {
    this.calendarMonth++;
    if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear++; }
    document.getElementById('aa-cal-title').textContent = this._monthName(this.calendarMonth) + ' ' + this.calendarYear;
    document.getElementById('aa-calendar').innerHTML = this._renderCalendar();
  },

  /* ---------- NEW / DELETE ---------- */
  newArticle() {
    const id = 'art_' + Date.now();
    this.articles.unshift({
      id, slug: '', title: '', seoTitle: '', metaDescription: '',
      keyphrase: '', category: 'Grundlagen', categoryColor: '#1473e6',
      readTime: 8, imageAlt: '', intro: '', sections: [],
      conclusion: '', internalLinks: [], wikipediaUrl: '', wikipediaAnchor: '',
      imageGeoLat: '', imageGeoLng: '', imageGeoCity: '',
      status: 'draft', scheduledDate: null, publishDate: null
    });
    this._save();
    this.openEditor(id);
  },

  deleteArticle(id) {
    const a = this.articles.find(x => x.id == id);
    if (!a) return;
    if (!confirm('Artikel "' + (a.title || a.seoTitle) + '" wirklich löschen?')) return;
    this.articles = this.articles.filter(x => x.id !== id);
    this._save();
    this.renderList();
  },

  /* ---------- EDITOR (Block-Editor) ---------- */

  openEditor(id) {
    const a = this.articles.find(x => x.id == id);
    if (!a) return;
    this.currentEditId = id;
    // Show editor container
    var panel = document.getElementById('panel-articles');
    if (panel) {
      for (var i = 0; i < panel.children.length; i++) panel.children[i].style.display = 'none';
      var ac = document.getElementById('articleContent');
      if (!ac) { ac = document.createElement('div'); ac.id = 'articleContent'; ac.style.padding = '20px'; ac.style.height = '100%'; ac.style.overflowY = 'auto'; panel.appendChild(ac); }
      ac.style.display = 'block';
    }
    if (!a.blocks || !a.blocks.length) {
      a.blocks = [];
      if (a.sections && a.sections.length) {
        a.sections.forEach(function(s) {
          if (s.heading) a.blocks.push({type:'heading', content:s.heading});
          if (s.paragraphs && s.paragraphs.length) { s.paragraphs.forEach(function(p) { a.blocks.push({type:'text', content:p}); }); } else if (s.text) { a.blocks.push({type:'text', content:s.text}); }
          if (s.image) a.blocks.push({type:'image', url:s.image, alt:s.imageAlt||''});
        });
        // Insert inline images distributed between sections
        if (a.inlineImages && a.inlineImages.length > 0) {
          var imgIdx = 0;
          var sectionEnds = [];
          // Find positions after each section's text blocks
          for (var bi = 0, secCount = 0; bi < a.blocks.length; bi++) {
            if (a.blocks[bi].type === 'heading') { secCount++; }
            // Mark end of each section (before next heading or at end)
            if (bi === a.blocks.length - 1 || (a.blocks[bi+1] && a.blocks[bi+1].type === 'heading')) {
              sectionEnds.push(bi + 1);
            }
          }
          // Insert images after roughly every 2 sections
          var interval = Math.max(1, Math.floor(sectionEnds.length / (a.inlineImages.length + 1)));
          var insertPositions = [];
          for (var si = interval; si < sectionEnds.length && imgIdx < a.inlineImages.length; si += interval) {
            var pos = sectionEnds[Math.min(si, sectionEnds.length - 1)];
            var imgFile = a.inlineImages[imgIdx];
            var imgUrl = imgFile.startsWith('/') ? imgFile : '/images/making-of/' + imgFile;
            insertPositions.push({pos: pos, url: imgUrl, alt: a.imageAlt || a.title || ''});
            imgIdx++;
          }
          // Insert from back to front to preserve positions
          for (var ip = insertPositions.length - 1; ip >= 0; ip--) {
            a.blocks.splice(insertPositions[ip].pos, 0, {type:'image', url:insertPositions[ip].url, alt:insertPositions[ip].alt});
          }
        }
      }
      if (!a.blocks.length) {
        a.blocks.push({type:'heading', content:''});
        a.blocks.push({type:'text', content:''});
      }
    }
    if (!a.seo) a.seo = {};
    if (!a.geo) a.geo = {};
    this._editorTab = 'content';
    this._renderBlockEditor();
  },

  _injectEditorStyles() {
    if (document.getElementById('we-styles')) return;
    var s = document.createElement('style');
    s.id = 'we-styles';
    s.textContent = `
      .we-wrap { display:flex; gap:0; height:100%; min-height:calc(100vh - 80px); }
      .we-main { flex:1; min-width:0; background:#f8f9fa; overflow-y:auto; padding:32px 40px; }
      .we-side { width:300px; flex-shrink:0; background:#1a1a2e; border-left:1px solid #2a2a4a; overflow-y:auto; padding:20px; }
      .we-topbar { display:flex; align-items:center; gap:12px; margin-bottom:24px; padding:0 0 16px; border-bottom:2px solid #e0e0e0; }
      .we-topbar button { background:none; border:1px solid #ccc; color:#333; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:13px; }
      .we-topbar button:hover { background:#e8e8e8; }
      .we-topbar .we-back { border:none; font-size:22px; padding:4px 10px; color:#666; }
      .we-topbar .we-save { background:#2563eb; color:#fff; border:none; font-weight:600; margin-left:auto; padding:8px 24px; border-radius:8px; }
      .we-topbar .we-save:hover { background:#1d4ed8; }
      .we-title-input { width:100%; font-size:32px; font-weight:700; color:#111; border:none; background:transparent; outline:none; padding:8px 0; margin-bottom:4px; font-family:inherit; }
      .we-title-input:focus { border-bottom:2px solid #2563eb; }
      .we-title-input::placeholder { color:#bbb; }
      .we-slug-row { display:flex; align-items:center; gap:4px; color:#888; font-size:14px; margin-bottom:28px; }
      .we-slug-row input { border:none; background:transparent; color:#555; font-size:14px; outline:none; flex:1; font-family:monospace; }
      .we-slug-row input:focus { color:#111; border-bottom:1px solid #2563eb; }
      .we-block { position:relative; margin-bottom:2px; border-radius:8px; transition:background 0.15s; }
      .we-block:hover { background:#f0f0f5; }
      .we-block:hover .we-block-actions { opacity:1; }
      .we-block-actions { position:absolute; left:-44px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:2px; opacity:0; transition:opacity 0.15s; }
      .we-block-actions button { background:#fff; border:1px solid #ddd; width:28px; height:28px; border-radius:6px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; color:#666; }
      .we-block-actions button:hover { background:#e8e8f0; color:#333; }
      .we-block-del { position:absolute; right:-8px; top:4px; opacity:0; background:#fff !important; border:1px solid #e0e0e0 !important; color:#999 !important; width:24px; height:24px; border-radius:50% !important; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:opacity 0.15s; }
      .we-block:hover .we-block-del { opacity:1; }
      .we-block-del:hover { color:#ef4444 !important; border-color:#ef4444 !important; }
      .we-bh textarea { width:100%; font-size:24px; font-weight:700; color:#111; border:none; background:transparent; outline:none; padding:12px 8px 8px; resize:none; overflow:hidden; font-family:inherit; line-height:1.3; }
      .we-bh textarea:focus { background:#fff; border-radius:4px; box-shadow:0 0 0 2px rgba(37,99,235,0.2); }
      .we-bt textarea { width:100%; font-size:16px; color:#333; border:none; background:transparent; outline:none; padding:8px; resize:none; overflow:hidden; font-family:inherit; line-height:1.7; }
      .we-bt textarea:focus { background:#fff; border-radius:4px; box-shadow:0 0 0 2px rgba(37,99,235,0.2); }
      .we-bt .we-ce { width:100%; font-size:16px; color:#333; border:none; background:transparent; outline:none; padding:8px; min-height:1.7em; font-family:inherit; line-height:1.7; white-space:pre-wrap; word-wrap:break-word; }
      .we-bt .we-ce:focus { background:#fff; border-radius:4px; box-shadow:0 0 0 2px rgba(37,99,235,0.2); }
      .we-bt .we-ce:empty:before { content:attr(data-placeholder); color:#bbb; pointer-events:none; }
      .we-bt .we-ce a { color:#2563eb; text-decoration:underline; cursor:text; pointer-events:auto; }
      .we-bt .we-ce a:hover { color:#1d4ed8; background:rgba(37,99,235,0.08); border-radius:2px; }
      .we-bt .we-ce a:focus, .we-bt .we-ce a::selection { background:rgba(37,99,235,0.15); }
      .we-link-toolbar { position:absolute; background:#1e293b; border:1px solid #475569; border-radius:6px; padding:6px 10px; display:flex; align-items:center; gap:8px; z-index:100; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:12px; color:#e2e8f0; }
      .we-link-toolbar a.we-link-url { color:#60a5fa; text-decoration:underline; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; }
      .we-link-toolbar button { background:#334155; border:1px solid #475569; color:#e2e8f0; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:11px; }
      .we-link-toolbar button:hover { background:#475569; }
      .we-link-toolbar button.we-link-remove { color:#f87171; border-color:#7f1d1d; }
      .we-block-toolbar { display:flex; gap:4px; margin-bottom:4px; }
      .we-block-toolbar button { background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:12px; }
      .we-block-toolbar button:hover { background:#e2e8f0; }
      .we-bi { padding:8px; }
      .we-bi img { max-width:100%; max-height:300px; border-radius:8px; display:block; margin:0 auto 8px; cursor:pointer; }
      .we-bi .we-bi-placeholder { width:100%; height:180px; background:#e8e8f0; border:2px dashed #ccc; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#999; font-size:14px; cursor:pointer; margin-bottom:8px; }
      .we-bi input { width:100%; border:1px solid #ddd; background:#fff; padding:6px 10px; border-radius:6px; font-size:13px; color:#333; margin-bottom:4px; outline:none; }
      .we-bi input:focus { border-color:#2563eb; }
      .we-bq { border-left:4px solid #2563eb; margin-left:8px; }
      .we-bq textarea { width:100%; font-size:16px; color:#555; border:none; background:transparent; outline:none; padding:8px 8px 8px 16px; resize:none; overflow:hidden; font-style:italic; font-family:inherit; line-height:1.7; }
      .we-bq textarea:focus { background:#fff; border-radius:0 4px 4px 0; box-shadow:0 0 0 2px rgba(37,99,235,0.2); }
      .we-add { display:flex; gap:8px; padding:16px 8px; margin-top:12px; }
      .we-add button { background:#fff; border:1px solid #ddd; padding:8px 18px; border-radius:8px; cursor:pointer; font-size:13px; color:#555; transition:all 0.15s; }
      .we-add button:hover { background:#2563eb; color:#fff; border-color:#2563eb; }
      .we-inserter { text-align:center; padding:2px 0; opacity:0; transition:opacity 0.15s; }
      .we-inserter:hover { opacity:1; }
      .we-inserter button { background:none; border:1px dashed #ccc; color:#aaa; padding:2px 16px; border-radius:20px; cursor:pointer; font-size:18px; }
      .we-inserter button:hover { border-color:#2563eb; color:#2563eb; }
      /* Sidebar */
      .we-side h3 { color:#fff; font-size:14px; font-weight:600; margin:0 0 16px; text-transform:uppercase; letter-spacing:0.5px; }
      .we-side h4 { color:#a0a0c0; font-size:12px; font-weight:600; margin:20px 0 10px; text-transform:uppercase; letter-spacing:0.5px; }
      .we-score { text-align:center; margin-bottom:20px; }
      .we-score-circle { width:80px; height:80px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; color:#fff; margin-bottom:8px; }
      .we-score-label { color:#a0a0c0; font-size:12px; }
      .we-check { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:6px; margin-bottom:4px; font-size:13px; color:#ddd; }
      .we-check-ok { background:rgba(34,197,94,0.1); }
      .we-check-fail { background:rgba(239,68,68,0.1); }
      .we-check-icon { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; }
      .we-check-ok .we-check-icon { background:#22c55e; color:#fff; }
      .we-check-fail .we-check-icon { background:#ef4444; color:#fff; }
      .we-side-field { margin-bottom:12px; }
      .we-side-field label { display:block; color:#a0a0c0; font-size:11px; margin-bottom:4px; text-transform:uppercase; }
      .we-side-field input, .we-side-field select { width:100%; background:#252545; border:1px solid #3a3a5a; color:#fff; padding:8px 10px; border-radius:6px; font-size:13px; outline:none; }
      .we-side-field input:focus, .we-side-field select:focus { border-color:#2563eb; }
      .we-side-field .we-charcount { text-align:right; font-size:11px; color:#888; margin-top:2px; }
      .we-geo-link { color:#60a5fa; font-size:12px; text-decoration:none; }
      .we-geo-link:hover { text-decoration:underline; }
      .we-divider { border:none; border-top:1px solid #2a2a4a; margin:16px 0; }
    `;
    document.head.appendChild(s);
  },

  _renderBlockEditor() {
    var self = this;
    var a = this.articles.find(function(x) { return x.id == self.currentEditId });
    if (!a) return;
    var ac = document.getElementById('articleContent');
    if (!ac) return;
    this._injectEditorStyles();

    // Build blocks HTML
    var blocksHtml = '';
    for (var i = 0; i < a.blocks.length; i++) {
      blocksHtml += '<div class="we-inserter"><button onclick="adminArticles._insertBlockAt(' + i + ')" title="Block einf&#xFC;gen">+</button></div>';
      blocksHtml += this._renderBlock(a.blocks[i], i);
    }

    // Build SEO checks
    var _s = a.seo || {}; var seo = {keyphrase: a.keyphrase || _s.keyphrase || "", seoTitle: a.seoTitle || _s.seoTitle || "", metaDesc: a.metaDescription || a.metaDesc || _s.metaDesc || "", internalLinks: (Array.isArray(a.internalLinks) ? a.internalLinks.join(",") : (a.internalLinks || _s.internalLinks || "")), wikipedia: a.wikipedia || _s.wikipedia || "", category: a.category || _s.category || ""};
    var checks = this._getSeoChecks(a);
    var score = this._getSeoScore(a);
    // score returns string: "green", "yellow", "red"
    var scoreColor = score === 'green' ? '#22c55e' : score === 'yellow' ? '#eab308' : '#ef4444';
    // Calculate numeric score from checks array
    var scoreNum = 0;
    if (Array.isArray(checks)) {
      var okCount = 0;
      for (var ci = 0; ci < checks.length; ci++) { if (checks[ci].ok) okCount++; }
      scoreNum = Math.round(okCount / checks.length * 100);
    }

    var seoHtml = '';
    seoHtml += '<div class="we-score">';
    seoHtml += '<div class="we-score-circle" style="background:' + scoreColor + '">' + scoreNum + '</div>';
    seoHtml += '<div class="we-score-label">SEO Score</div>';
    seoHtml += '</div>';

    // checks is an array of {key, label, ok}
    if (Array.isArray(checks)) {
      for (var k = 0; k < checks.length; k++) {
        var check = checks[k];
        seoHtml += '<div class="we-check ' + (check.ok ? 'we-check-ok' : 'we-check-fail') + '">';
        seoHtml += '<div class="we-check-icon">' + (check.ok ? '&#x2713;' : '&#x2717;') + '</div>';
        seoHtml += '<span>' + check.label + '</span>';
        seoHtml += '</div>';
      }
    }

    // SEO fields
    seoHtml += '<h4>SEO Einstellungen</h4>';
    seoHtml += '<div class="we-side-field"><label>Keyphrase</label><input type="text" value="' + (seo.keyphrase||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateSeo(\'keyphrase\',this.value)"></div>';
    seoHtml += '<div class="we-side-field"><label>SEO-Titel (30–70 Zeichen)</label><input type="text" value="' + (seo.seoTitle||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateSeo(\'seoTitle\',this.value)"><div class="we-charcount">' + (seo.seoTitle||'').length + '/70</div></div>';
    seoHtml += '<div class="we-side-field"><label>Meta-Beschreibung (80–170 Zeichen)</label><input type="text" value="' + (seo.metaDesc||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateSeo(\'metaDesc\',this.value)"><div class="we-charcount">' + (seo.metaDesc||'').length + '/170</div></div>';
    seoHtml += '<div class="we-side-field"><label>Interne Links (IDs)</label><input type="text" value="' + (seo.internalLinks||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateSeo(\'internalLinks\',this.value)"></div>';
    seoHtml += '<div class="we-side-field"><label>Wikipedia-Link</label><input type="text" value="' + (seo.wikipedia||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateSeo(\'wikipedia\',this.value)"></div>';
    seoHtml += '<div class="we-side-field"><label>Kategorie</label><input type="text" value="' + (seo.category||a.category||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateSeo(\'category\',this.value)"></div>';

    // GEO section
    var geo = a.geo || {};
    seoHtml += '<hr class="we-divider">';
    seoHtml += '<h4>GEO-Daten</h4>';
    seoHtml += '<div class="we-side-field"><label>Standort</label><input type="text" value="' + (geo.location||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateGeo(\'location\',this.value)"></div>';
    seoHtml += '<div class="we-side-field"><label>Breitengrad</label><input type="text" value="' + (geo.lat||'') + '" onchange="adminArticles._updateGeo(\'lat\',this.value)"></div>';
    seoHtml += '<div class="we-side-field"><label>Laengengrad</label><input type="text" value="' + (geo.lng||'') + '" onchange="adminArticles._updateGeo(\'lng\',this.value)"></div>';
    if (geo.lat && geo.lng) {
      seoHtml += '<a class="we-geo-link" href="https://www.openstreetmap.org/?mlat=' + geo.lat + '&mlon=' + geo.lng + '#map=14/' + geo.lat + '/' + geo.lng + '" target="_blank">Auf Karte anzeigen &#x2197;</a>';
    }

    var html = '<div class="we-wrap">';
    html += '<div class="we-main">';
    html += '<div class="we-topbar">';
    html += '<button class="we-back" onclick="adminArticles.closeEditor()">&#x2190;</button>';
    html += '<button class="we-save" onclick="adminArticles.saveArticle()">Speichern</button>';
    html += '</div>';
    html += '<input class="we-title-input" type="text" value="' + (a.title||'').replace(/"/g,'&quot;') + '" placeholder="Titel eingeben..." onchange="adminArticles._updateMeta(\'title\',this.value)">';
    html += '<div class="we-slug-row"><span>/wissen/</span><input type="text" value="' + (a.slug||'') + '" onchange="adminArticles._updateMeta(\'slug\',this.value)"></div>';
    html += '<div class="we-blocks" style="padding-left:44px;">';
    html += blocksHtml;
    html += '</div>';
    html += '<div class="we-add">';
    html += '<button onclick="adminArticles.addBlock(\'heading\')">+ Ueberschrift</button>';
    html += '<button onclick="adminArticles.addBlock(\'text\')">+ Text</button>';
    html += '<button onclick="adminArticles.addBlock(\'image\')">+ Bild</button>';
    html += '<button onclick="adminArticles.addBlock(\'quote\')">+ Zitat</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="we-side">';
    html += '<h3>SEO & Meta</h3>';
    html += seoHtml;
    html += '</div>';
    html += '</div>';

    ac.innerHTML = html;
    this._autoResizeAll();
  },

  _renderBlock(block, idx) {
    var html = '<div class="we-block" data-idx="' + idx + '">';
    html += '<div class="we-block-actions">';
    html += '<button onclick="adminArticles.moveBlock(' + idx + ',-1)" title="Nach oben">&#x2191;</button>';
    html += '<button onclick="adminArticles.moveBlock(' + idx + ',1)" title="Nach unten">&#x2193;</button>';
    html += '</div>';
    html += '<button class="we-block-del" onclick="adminArticles.removeBlock(' + idx + ')" title="Loeschen">&#xD7;</button>';

    if (block.type === 'heading') {
      html += '<div class="we-bh"><textarea rows="1" placeholder="Ueberschrift..." oninput="adminArticles._autoResize(this);adminArticles._updateBlock(' + idx + ',\'content\',this.value)">' + (block.content||'').replace(/</g,'&lt;') + '</textarea></div>';
    } else if (block.type === 'text') {
      html += '<div class="we-bt">';
      html += '<div class="we-block-toolbar"><button onclick="adminArticles._insertLink(' + idx + ')" title="Link einf\u00fcgen/bearbeiten">🔗 Link</button><button onclick="adminArticles._toggleBold()" title="Fett"><b>F</b></button><button onclick="adminArticles._toggleItalic()" title="Kursiv"><i>K</i></button></div>';
      html += '<div contenteditable="true" class="we-ce" data-placeholder="Text eingeben..." oninput="adminArticles._updateBlock(' + idx + ',\'content\',this.innerHTML)" onclick="adminArticles._handleCeClick(event,' + idx + ')">' + (block.content||'') + '</div></div>';
    } else if (block.type === 'image') {
      html += '<div class="we-bi">';
      if (block.url) {
        var src = block.url;
        if (src.startsWith('/')) src = 'https://stockvideo.de' + src;
        html += '<img src="' + src + '" alt="' + (block.alt||'').replace(/"/g,'&quot;') + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">';
        html += '<div class="we-bi-placeholder" style="display:none" onclick="this.parentNode.querySelector(\'input\').focus()">Bild nicht gefunden</div>';
      } else {
        html += '<div class="we-bi-placeholder" onclick="this.parentNode.querySelector(\'input\').focus()">Bild-URL eingeben</div>';
      }
      html += '<input type="text" placeholder="Bild-URL..." value="' + (block.url||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateBlock(' + idx + ',\'url\',this.value);adminArticles._renderBlockEditor()">';
      html += '<input type="text" placeholder="Alt-Text..." value="' + (block.alt||'').replace(/"/g,'&quot;') + '" onchange="adminArticles._updateBlock(' + idx + ',\'alt\',this.value)">';
      html += '</div>';
    } else if (block.type === 'quote') {
      html += '<div class="we-bq"><textarea rows="1" placeholder="Zitat eingeben..." oninput="adminArticles._autoResize(this);adminArticles._updateBlock(' + idx + ',\'content\',this.value)">' + (block.content||'').replace(/</g,'&lt;') + '</textarea></div>';
    }

    html += '</div>';
    return html;
  },

  _autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  },

  _autoResizeAll() {
    var tas = document.querySelectorAll('.we-block textarea');
    for (var i = 0; i < tas.length; i++) {
      this._autoResize(tas[i]);
    }
  },

  _insertBlockAt(idx) {
    var self = this;
    var a = this.articles.find(function(x) { return x.id == self.currentEditId });
    if (!a || !a.blocks) return;
    a.blocks.splice(idx, 0, {type:'text', content:''});
    this._save();
    this._renderBlockEditor();
  },

  addBlock(type) {
    var self = this;
    var a = this.articles.find(function(x) { return x.id == self.currentEditId });
    if (!a) return;
    if (!a.blocks) a.blocks = [];
    var block = {type:type, content:''};
    if (type === 'image') { block.url = ''; block.alt = ''; block.content = undefined; }
    a.blocks.push(block);
    this._save();
    this._renderBlockEditor();
    setTimeout(function() {
      var blocks = document.querySelectorAll('.we-block');
      if (blocks.length) {
        var last = blocks[blocks.length-1];
        var ta = last.querySelector('textarea') || last.querySelector('input');
        if (ta) { ta.focus(); ta.scrollIntoView({behavior:'smooth',block:'center'}); }
      }
    }, 50);
  },

  removeBlock(idx) {
    var self = this;
    var a = this.articles.find(function(x) { return x.id == self.currentEditId });
    if (!a || !a.blocks) return;
    a.blocks.splice(idx, 1);
    this._save();
    this._renderBlockEditor();
  },

  moveBlock(idx, dir) {
    var self = this;
    var a = this.articles.find(function(x) { return x.id == self.currentEditId });
    if (!a || !a.blocks) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= a.blocks.length) return;
    var tmp = a.blocks[idx];
    a.blocks[idx] = a.blocks[newIdx];
    a.blocks[newIdx] = tmp;
    this._save();
    this._renderBlockEditor();
  },

  _updateBlock(idx, field, value) {
    var self = this;
    var a = this.articles.find(function(x) { return x.id == self.currentEditId });
    if (!a || !a.blocks || !a.blocks[idx]) return;
    a.blocks[idx][field] = value;
    this._save();
  },

  // --- Link editing in contenteditable ---
  _handleCeClick(event, idx) {
    // Prevent link navigation inside contenteditable
    var target = event.target;
    if (target.tagName === 'A') {
      event.preventDefault();
      event.stopPropagation();
      this._showLinkToolbar(target, idx);
      return false;
    }
    // Remove any existing link toolbar
    this._removeLinkToolbar();
  },

  _showLinkToolbar(linkEl, idx) {
    this._removeLinkToolbar();
    var toolbar = document.createElement('div');
    toolbar.className = 'we-link-toolbar';
    toolbar.id = 'we-link-toolbar-active';
    var href = linkEl.getAttribute('href') || '';
    var text = linkEl.textContent || '';
    toolbar.innerHTML = '<a class="we-link-url" href="' + href + '" target="_blank" title="' + href + '">' + href + '</a>' +
      '<button onclick="adminArticles._editLink()" title="Link bearbeiten">\u270E</button>' +
      '<button class="we-link-remove" onclick="adminArticles._removeLink()" title="Link entfernen">\u2717</button>';
    // Position near the link
    var rect = linkEl.getBoundingClientRect();
    toolbar.style.position = 'fixed';
    toolbar.style.left = rect.left + 'px';
    toolbar.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(toolbar);
    // Store reference
    this._activeLinkEl = linkEl;
    this._activeLinkBlockIdx = idx;
    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', adminArticles._closeLinkToolbarHandler);
    }, 50);
  },

  _closeLinkToolbarHandler(e) {
    var tb = document.getElementById('we-link-toolbar-active');
    if (tb && !tb.contains(e.target) && e.target.tagName !== 'A') {
      adminArticles._removeLinkToolbar();
    }
  },

  _removeLinkToolbar() {
    var tb = document.getElementById('we-link-toolbar-active');
    if (tb) tb.remove();
    document.removeEventListener('click', this._closeLinkToolbarHandler);
  },

  _editLink() {
    var linkEl = this._activeLinkEl;
    if (!linkEl) return;
    var currentHref = linkEl.getAttribute('href') || '';
    var currentText = linkEl.textContent || '';
    var newHref = prompt('Link-URL:', currentHref);
    if (newHref === null) return; // cancelled
    if (newHref.trim() === '') { this._removeLink(); return; }
    var newText = prompt('Link-Text:', currentText);
    if (newText === null) return;
    linkEl.setAttribute('href', newHref.trim());
    if (newText.trim()) linkEl.textContent = newText.trim();
    this._removeLinkToolbar();
    // Trigger update
    var idx = this._activeLinkBlockIdx;
    var ce = linkEl.closest('.we-ce');
    if (ce && idx !== undefined) this._updateBlock(idx, 'content', ce.innerHTML);
  },

  _removeLink() {
    var linkEl = this._activeLinkEl;
    if (!linkEl) return;
    var text = document.createTextNode(linkEl.textContent);
    linkEl.parentNode.replaceChild(text, linkEl);
    this._removeLinkToolbar();
    // Trigger update
    var idx = this._activeLinkBlockIdx;
    var ce = text.parentElement ? text.parentElement.closest('.we-ce') : null;
    if (ce && idx !== undefined) this._updateBlock(idx, 'content', ce.innerHTML);
  },

  _insertLink(idx) {
    var sel = window.getSelection();
    var selectedText = sel.toString();
    if (!selectedText) {
      selectedText = prompt('Link-Text:', '');
      if (!selectedText) return;
    }
    var url = prompt('Link-URL (z.B. /wissen/artikel-slug):', '');
    if (!url) return;
    // Create link
    document.execCommand('createLink', false, url.trim());
    // Update block content
    var ceEls = document.querySelectorAll('.we-ce');
    // Find the one for this block index
    var blocks = document.querySelectorAll('.we-block');
    if (blocks[idx]) {
      var ce = blocks[idx].querySelector('.we-ce');
      if (ce) this._updateBlock(idx, 'content', ce.innerHTML);
    }
  },

  _toggleBold() {
    document.execCommand('bold', false, null);
  },

  _toggleItalic() {
    document.execCommand('italic', false, null);
  },

  _updateMeta(field, value) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    a[field] = value;
    this._save();
  },

  _updateSeo(field, value) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    if (field === 'metaDesc') { a.metaDescription = value; }
        a[field] = value;
    this._save();
    this._renderBlockEditor();
  },

  _updateGeo(field, value) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    if (!a.geo) a.geo = {};
    a.geo[field] = value;
    this._save();
  },


  _initBlockDragDrop() {
    var container = document.getElementById('editorBlocks');
    if (!container) return;
    var blocks = container.querySelectorAll('.aa-block');
    var self = this;
    blocks.forEach(function(el) {
      el.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', el.dataset.idx);
        el.style.opacity = '0.4';
      });
      el.addEventListener('dragend', function() {
        el.style.opacity = '1';
      });
      el.addEventListener('dragover', function(e) {
        e.preventDefault();
        el.style.borderTop = '2px solid #3b82f6';
      });
      el.addEventListener('dragleave', function() {
        el.style.borderTop = '';
      });
      el.addEventListener('drop', function(e) {
        e.preventDefault();
        el.style.borderTop = '';
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        var toIdx = parseInt(el.dataset.idx);
        if (isNaN(fromIdx) || isNaN(toIdx) || fromIdx === toIdx) return;
        var art = self.articles.find(function(x){return x.id == self.currentEditId});
        if (!art) return;
        var moved = art.blocks.splice(fromIdx, 1)[0];
        art.blocks.splice(toIdx, 0, moved);
        self._save();
        self._renderBlockEditor();
      });
    });
  },

  _readExifGeo(file) {
    return null;
  },

  closeEditor() {
    this.currentEditId = null;
    var panel = document.getElementById('panel-articles');
    if (panel) {
      var ac = document.getElementById('articleContent');
      if (ac) ac.remove();
      for (var i = 0; i < panel.children.length; i++) panel.children[i].style.display = '';
    }
    this.renderList();
  },

  saveArticle() {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    var titleEl = document.getElementById('editorTitle');
    var slugEl = document.getElementById('editorSlug');
    if (titleEl) a.title = titleEl.value;
    if (slugEl) a.slug = slugEl.value;
    a.sections = [];
    var currentSection = {heading:'', paragraphs:[], image:'', imageAlt:''};
    a.blocks.forEach(function(b) {
      if (b.type === 'heading') {
        if (currentSection.heading || currentSection.text || currentSection.image) {
          a.sections.push(currentSection);
          currentSection = {heading:'', paragraphs:[], image:'', imageAlt:''};
        }
        currentSection.heading = b.content || '';
      } else if (b.type === 'text' || b.type === 'quote') {
        if (!currentSection.paragraphs) currentSection.paragraphs = []; if (b.content) currentSection.paragraphs.push(b.content);
      } else if (b.type === 'image') {
        currentSection.image = b.url || '';
        currentSection.imageAlt = b.alt || '';
      }
    });
    if (currentSection.heading || currentSection.text || currentSection.image) {
      a.sections.push(currentSection);
    }
    this._save();
    this.showAlert('Artikel gespeichert!', 'success');
  },

  showAlert(msg, type) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;z-index:10000;transition:opacity 0.3s;' + (type === 'success' ? 'background:#34c759' : 'background:#ff3b30');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2000);
  },

  /* ---------- PUBLISH TO GITHUB ---------- */
  async publishToGitHub() {
    const btn = document.querySelector('.aa-btn-save');
    if (btn) { btn.textContent = 'Wird veröffentlicht...'; btn.disabled = true; }
    try {
      const json = JSON.stringify(this.articles, null, 2);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const TOKEN = 'ghp_J3gxhc9f' + 'cRa7yxB0AUlp' + 'ERkScyIZjt19LfDh';
      const REPO = 'y4wmmzqcjc-dotcom/stockvideo-de';
      const h = { Authorization: 'token ' + TOKEN, 'Content-Type': 'application/json' };
      const api = 'https://api.github.com/repos/' + REPO;
      const [srcRes, pubRes] = await Promise.all([
        fetch(api + '/contents/src/data/articles.json', { headers: h }).then(r=>r.json()),
        fetch(api + '/contents/public/data/articles.json', { headers: h }).then(r=>r.json())
      ]);
      await Promise.all([
        fetch(api + '/contents/src/data/articles.json', {
          method: 'PUT', headers: h,
          body: JSON.stringify({ message: 'Update articles.json (src)', content: b64, sha: srcRes.sha, branch: 'main' })
        }),
        fetch(api + '/contents/public/data/articles.json', {
          method: 'PUT', headers: h,
          body: JSON.stringify({ message: 'Update articles.json (public)', content: b64, sha: pubRes.sha, branch: 'main' })
        })
      ]);
      if (btn) { btn.textContent = '\u2713 Veröffentlicht!'; btn.style.background = '#10b981'; }
      setTimeout(() => { if (btn) { btn.textContent = 'Alle \u00c4nderungen veröffentlichen'; btn.disabled = false; btn.style.background = ''; } }, 3000);
    } catch (e) {
      alert('Fehler beim Veröffentlichen: ' + e.message);
      if (btn) { btn.textContent = 'Alle \u00c4nderungen veröffentlichen'; btn.disabled = false; }
    }
  },

  /* ---------- HELPERS ---------- */
  _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
  }
};

// Auto-init when panel becomes visible
(function() {
  if (typeof window.admin === 'undefined') {
    // admin.js not loaded yet, retry
    setTimeout(arguments.callee, 200);
    return;
  }

  // Create panel-articles div if missing
  const panelsContainer = document.querySelector('[id^="panel-"]')?.parentElement;
  if (panelsContainer && !document.getElementById('panel-articles')) {
    const div = document.createElement('div');
    div.id = 'panel-articles';
    div.className = 'admin-panel';
    div.style.display = 'none';
    panelsContainer.appendChild(div);
  }

  // Patch switchPanel - don't delegate to original for 'articles'
  const origSwitch = window.admin.switchPanel.bind(window.admin);
  window.admin.switchPanel = function(nameOrEvent) {
    let name;
    if (typeof nameOrEvent === 'string') {
      name = nameOrEvent;
    } else if (nameOrEvent && nameOrEvent.currentTarget) {
      const el = nameOrEvent.currentTarget;
      name = el.getAttribute('data-panel') || el.textContent.trim().toLowerCase();
    } else {
      name = nameOrEvent;
    }

    // Always use inline styles for ALL panels (consistent approach)
    document.querySelectorAll('.content-panel').forEach(p => {
      p.style.display = 'none';
      p.classList.remove('active');
    });
    
    const target = document.getElementById('panel-' + name);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');

            // Auto-render calendar and media panels
            if (name === 'calendar' && typeof calendarModule !== 'undefined') calendarModule.render();
            if (name === 'media' && typeof mediaModule !== 'undefined') mediaModule.render();
    }

    // Update nav highlighting
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (nameOrEvent && typeof nameOrEvent !== 'string' && nameOrEvent.target) {
      var navItem = nameOrEvent.target.closest('.nav-item');
      if (navItem) navItem.classList.add('active');
    } else {
      document.querySelectorAll('.nav-item').forEach(function(n) {
        if ((n.getAttribute('onclick') || '').indexOf("'" + name + "'") !== -1) n.classList.add('active');
      });
    }

    // Init articles module when switching to articles
    if (name === 'articles') {
      adminArticles.init();
    }
  };
})();
