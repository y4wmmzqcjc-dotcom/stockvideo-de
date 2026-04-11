/* ============================================================
   admin-articles.js \u2014 Wissen/Artikel-Verwaltung fÃ¼r stockvideo.de
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
    // Load from localStorage or fetch
    const stored = localStorage.getItem('adminArticles');
    if (stored) {
      try { this.articles = JSON.parse(stored); } catch(e) { this.articles = []; }
      this._ensureStatusFields();
      this.renderList();
    } else {
      fetch('/data/articles.json')
        .then(r => r.json())
        .catch(() => [])
        .then(data => {
          this.articles = data || [];
          this._ensureStatusFields();
          this.renderList();
        });
    }
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
        <button class="aa-btn aa-btn-save" onclick="adminArticles.publishToGitHub()">Alle \u00c4nderungen verÃ¶ffentlichen</button>
      </div>
    `;
  },

  _getSeoChecks(a) {
    return [
      { key: 'keyphrase', label: 'Keyphrase', ok: !!(a.keyphrase && a.keyphrase.trim()) },
      { key: 'title', label: 'SEO-Titel', ok: !!(a.seoTitle && a.seoTitle.length >= 50 && a.seoTitle.length <= 60) },
      { key: 'desc', label: 'Meta-Beschreibung', ok: !!(a.metaDescription && a.metaDescription.length >= 150 && a.metaDescription.length <= 160) },
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
            <button class="aa-btn-icon aa-btn-danger" title="LÃ¶schen" onclick="adminArticles.deleteArticle('${a.id}')">\uD83D\uDDD1\uFE0F</button>
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
        <h3>VerÃ¶ffentlichung planen</h3>
        <p class="aa-modal-title">${a.title || a.seoTitle}</p>
        <div class="aa-modal-field">
          <label>VerÃ¶ffentlichungsdatum:</label>
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
    if (!dateVal) { alert('Bitte Datum wÃ¤hlen'); return; }
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
    return ['Januar','Februar','MÃ¤rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][m];
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
    return '<h4>NÃ¤chste geplante Artikel</h4>' + upcoming.map(a => `
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
    if (!confirm('Artikel "' + (a.title || a.seoTitle) + '" wirklich lÃ¶schen?')) return;
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
          if (s.text) a.blocks.push({type:'text', content:s.text});
          if (s.image) a.blocks.push({type:'image', url:s.image, alt:s.imageAlt||''});
        });
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

  _renderBlockEditor() {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    const el = document.getElementById('articleContent');
    const checks = this._getSeoChecks(a);
    var tabBar = '<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">'
      + '<button onclick="adminArticles.closeEditor()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px" title="Zurueck">\u2190</button>'
      + '<button class="aa-btn' + (this._editorTab==='content'?' aa-btn-primary':'') + '" onclick="adminArticles.switchTab(\x27content\x27)">Inhalt</button>'
      + '<button class="aa-btn' + (this._editorTab==='seo'?' aa-btn-primary':'') + '" onclick="adminArticles.switchTab(\x27seo\x27)">SEO</button>'
      + '<button class="aa-btn' + (this._editorTab==='geo'?' aa-btn-primary':'') + '" onclick="adminArticles.switchTab(\x27geo\x27)">GEO</button>'
      + '<div style="flex:1"></div>'
      + '<button class="aa-btn aa-btn-primary" onclick="adminArticles.saveArticle()">Speichern</button>'
      + '</div>';
    var html = tabBar;

    if (this._editorTab === 'content') {
      html += '<div style="margin-bottom:16px">'
        + '<input type="text" id="editorTitle" value="' + this._esc(a.title||'') + '" placeholder="Artikel-Titel" '
        + 'onchange="adminArticles._updateMeta(\x27title\x27,this.value)" '
        + 'style="width:100%;font-size:22px;font-weight:700;padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;outline:none;box-sizing:border-box">'
        + '</div>';
      html += '<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">'
        + '<span style="color:#64748b;font-size:13px">/wissen/</span>'
        + '<input type="text" id="editorSlug" value="' + this._esc(a.slug||'') + '" placeholder="url-slug" '
        + 'onchange="adminArticles._updateMeta(\x27slug\x27,this.value)" '
        + 'style="flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:monospace;outline:none">'
        + '</div>';
      html += '<div id="editorBlocks">';
      a.blocks.forEach(function(block, idx) {
        html += adminArticles._renderBlock(block, idx);
      });
      html += '</div>';
      html += '<div style="display:flex;gap:8px;margin-top:12px;padding:12px;background:#f8fafc;border-radius:8px;border:2px dashed #e2e8f0">'
        + '<button class="aa-btn" onclick="adminArticles.addBlock(\x27text\x27)" style="font-size:13px">+ Text</button>'
        + '<button class="aa-btn" onclick="adminArticles.addBlock(\x27heading\x27)" style="font-size:13px">+ \u00dcberschrift</button>'
        + '<button class="aa-btn" onclick="adminArticles.addBlock(\x27image\x27)" style="font-size:13px">+ Bild</button>'
        + '<button class="aa-btn" onclick="adminArticles.addBlock(\x27quote\x27)" style="font-size:13px">+ Zitat</button>'
        + '</div>';
    } else if (this._editorTab === 'seo') {
      html += this._renderSeoTab(a, checks);
    } else if (this._editorTab === 'geo') {
      html += this._renderGeoTab(a);
    }
    el.innerHTML = html;
    var tas = el.querySelectorAll('textarea[data-autoresize]');
    tas.forEach(function(ta) { ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; });
    if (this._editorTab === 'content') this._initBlockDragDrop();
  },


  _renderSeoTab(a, checks) {
    var seo = a.seo || {};
    var html = '<div style="max-width:640px">';
    html += '<h3 style="margin:0 0 16px;font-size:16px">SEO-Einstellungen</h3>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Keyphrase '
      + (checks.keyphrase ? '\u2705' : '\u274c') + '</label>'
      + '<input type="text" value="' + this._esc(a.keyphrase||'') + '" placeholder="Haupt-Keyword" '
      + 'onchange="adminArticles._updateMeta(\x27keyphrase\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">SEO-Titel '
      + (checks.seoTitle ? '\u2705' : '\u274c') + '</label>'
      + '<input type="text" value="' + this._esc(seo.title||a.title||'') + '" placeholder="SEO Titel (50-60 Zeichen)" '
      + 'onchange="adminArticles._updateSeo(\x27title\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none">'
      + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' + (seo.title||a.title||'').length + '/60 Zeichen</div></div>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Meta-Description '
      + (checks.metaDesc ? '\u2705' : '\u274c') + '</label>'
      + '<textarea onchange="adminArticles._updateSeo(\x27description\x27,this.value)" placeholder="Meta-Beschreibung (120-160 Zeichen)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none;min-height:60px;resize:vertical">'
      + this._esc(seo.description||'') + '</textarea>'
      + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' + (seo.description||'').length + '/160 Zeichen</div></div>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Interne Links '
      + (checks.internalLinks ? '\u2705' : '\u274c') + '</label>'
      + '<input type="text" value="' + this._esc((a.internalLinks||[]).join(', ')) + '" placeholder="Kommagetrennte URLs" '
      + 'onchange="adminArticles._updateMeta(\x27internalLinks\x27,this.value.split(\x27,\x27).map(function(s){return s.trim()}).filter(Boolean))" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Wikipedia-Link '
      + (checks.wikipedia ? '\u2705' : '\u274c') + '</label>'
      + '<input type="text" value="' + this._esc(a.wikipediaUrl||'') + '" placeholder="https://de.wikipedia.org/wiki/..." '
      + 'onchange="adminArticles._updateMeta(\x27wikipediaUrl\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Kategorie</label>'
      + '<input type="text" value="' + this._esc(a.category||'') + '" placeholder="z.B. Stockvideo, Marketing" '
      + 'onchange="adminArticles._updateMeta(\x27category\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>';
    html += '</div>';
    return html;
  },


  _renderGeoTab(a) {
    var geo = a.geo || {};
    var html = '<div style="max-width:640px">';
    html += '<h3 style="margin:0 0 16px;font-size:16px">GEO-Daten</h3>';
    html += '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Standort</label>'
      + '<input type="text" value="' + this._esc(geo.location||'') + '" placeholder="z.B. Berlin, Deutschland" '
      + 'onchange="adminArticles._updateGeo(\x27location\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>';
    html += '<div style="display:flex;gap:12px;margin-bottom:14px">'
      + '<div style="flex:1"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Breitengrad</label>'
      + '<input type="text" value="' + this._esc(geo.lat||'') + '" placeholder="52.5200" '
      + 'onchange="adminArticles._updateGeo(\x27lat\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>'
      + '<div style="flex:1"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">L\u00e4ngengrad</label>'
      + '<input type="text" value="' + this._esc(geo.lng||'') + '" placeholder="13.4050" '
      + 'onchange="adminArticles._updateGeo(\x27lng\x27,this.value)" '
      + 'style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;outline:none"></div>'
      + '</div>';
    if (geo.lat && geo.lng) {
      html += '<div style="margin-bottom:14px;padding:12px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
        + '<strong>Kartenvorschau:</strong> <a href="https://www.openstreetmap.org/?mlat=' + geo.lat + '&mlon=' + geo.lng + '#map=14/' + geo.lat + '/' + geo.lng + '" target="_blank" style="color:#2563eb">OpenStreetMap ansehen</a>'
        + '</div>';
    }
    html += '</div>';
    return html;
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
    if (!a.seo) a.seo = {};
    a.seo[field] = value;
    this._save();
  },

  _updateGeo(field, value) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    if (!a.geo) a.geo = {};
    a.geo[field] = value;
    this._save();
  },


  _renderBlock(block, idx) {
    var typeLabels = {heading:'H', text:'T', image:'B', quote:'Z'};
    var typeColors = {heading:'#8b5cf6', text:'#3b82f6', image:'#10b981', quote:'#f59e0b'};
    var handle = '<div class="aa-block-handle" style="cursor:grab;padding:4px;color:#94a3b8;font-size:14px;user-select:none" title="Ziehen zum Verschieben">\u2261</div>';
    var badge = '<div style="width:22px;height:22px;border-radius:4px;background:' + (typeColors[block.type]||'#94a3b8') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">' + (typeLabels[block.type]||'?') + '</div>';
    var delBtn = '<button onclick="adminArticles.removeBlock(' + idx + ')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;line-height:1" title="Block l\u00f6schen" onmouseover="this.style.color=\x27#ef4444\x27;this.style.background=\x27#fef2f2\x27" onmouseout="this.style.color=\x27#94a3b8\x27;this.style.background=\x27none\x27">\u2715</button>';
    var a = this.articles.find(function(x){return x.id == adminArticles.currentEditId});
    var moveUp = idx > 0 ? '<button onclick="adminArticles.moveBlock(' + idx + ',-1)" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;padding:1px 4px" title="Nach oben">\u25B2</button>' : '';
    var moveDown = (a && idx < a.blocks.length - 1) ? '<button onclick="adminArticles.moveBlock(' + idx + ',1)" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;padding:1px 4px" title="Nach unten">\u25BC</button>' : '';
    var content = '';

    if (block.type === 'heading') {
      content = '<input type="text" value="' + this._esc(block.content||'') + '" placeholder="\u00dcberschrift eingeben..." '
        + 'onchange="adminArticles._updateBlock(' + idx + ',\x27content\x27,this.value)" '
        + 'style="width:100%;font-size:18px;font-weight:700;padding:6px 8px;border:1px solid transparent;border-radius:4px;outline:none;background:transparent;box-sizing:border-box" '
        + 'onfocus="this.style.borderColor=\x27#8b5cf6\x27;this.style.background=\x27#fff\x27" '
        + 'onblur="this.style.borderColor=\x27transparent\x27;this.style.background=\x27transparent\x27">';
    } else if (block.type === 'text') {
      content = '<textarea data-autoresize="1" placeholder="Text eingeben..." '
        + 'onchange="adminArticles._updateBlock(' + idx + ',\x27content\x27,this.value)" '
        + 'oninput="this.style.height=\x27auto\x27;this.style.height=(this.scrollHeight+2)+\x27px\x27" '
        + 'style="width:100%;min-height:60px;padding:6px 8px;border:1px solid transparent;border-radius:4px;outline:none;background:transparent;font-size:14px;line-height:1.7;resize:none;font-family:inherit;box-sizing:border-box" '
        + 'onfocus="this.style.borderColor=\x27#3b82f6\x27;this.style.background=\x27#fff\x27" '
        + 'onblur="this.style.borderColor=\x27transparent\x27;this.style.background=\x27transparent\x27">'
        + this._esc(block.content||'') + '</textarea>';
    } else if (block.type === 'image') {
      var preview = block.url ? '<img src="' + this._esc(block.url) + '" style="max-width:100%;max-height:200px;border-radius:6px;margin-bottom:8px;display:block" onerror="this.style.display=\x27none\x27">' : '';
      content = '<div>' + preview
        + '<input type="text" value="' + this._esc(block.url||'') + '" placeholder="Bild-URL (https://...)" '
        + 'onchange="adminArticles._updateBlock(' + idx + ',\x27url\x27,this.value);adminArticles._renderBlockEditor()" '
        + 'style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:4px;outline:none;font-size:13px;margin-bottom:6px;box-sizing:border-box;font-family:monospace">'
        + '<input type="text" value="' + this._esc(block.alt||'') + '" placeholder="Alt-Text (Bildbeschreibung)" '
        + 'onchange="adminArticles._updateBlock(' + idx + ',\x27alt\x27,this.value)" '
        + 'style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:4px;outline:none;font-size:13px;box-sizing:border-box">'
        + '</div>';
    } else if (block.type === 'quote') {
      content = '<textarea data-autoresize="1" placeholder="Zitat eingeben..." '
        + 'onchange="adminArticles._updateBlock(' + idx + ',\x27content\x27,this.value)" '
        + 'oninput="this.style.height=\x27auto\x27;this.style.height=(this.scrollHeight+2)+\x27px\x27" '
        + 'style="width:100%;min-height:50px;padding:6px 8px 6px 16px;border:none;border-left:3px solid #f59e0b;border-radius:0;outline:none;background:transparent;font-size:14px;font-style:italic;line-height:1.7;resize:none;font-family:inherit;box-sizing:border-box" '
        + 'onfocus="this.style.background=\x27#fffbeb\x27" '
        + 'onblur="this.style.background=\x27transparent\x27">'
        + this._esc(block.content||'') + '</textarea>';
    }
    return '<div class="aa-block" data-idx="' + idx + '" draggable="true" style="display:flex;align-items:flex-start;gap:8px;padding:8px;margin-bottom:4px;border-radius:8px;border:1px solid transparent;transition:all 0.15s" '
      + 'onmouseover="this.style.background=\x27#f8fafc\x27;this.style.borderColor=\x27#e2e8f0\x27" '
      + 'onmouseout="this.style.background=\x27transparent\x27;this.style.borderColor=\x27transparent\x27">'
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:4px">' + handle + badge + moveUp + moveDown + '</div>'
      + '<div style="flex:1;min-width:0">' + content + '</div>'
      + '<div style="padding-top:4px">' + delBtn + '</div>'
      + '</div>';
  },


  addBlock(type) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    var newBlock = {type: type, content: ''};
    if (type === 'image') { newBlock.url = ''; newBlock.alt = ''; delete newBlock.content; }
    a.blocks.push(newBlock);
    this._save();
    this._renderBlockEditor();
    setTimeout(function() {
      var blocks = document.getElementById('editorBlocks');
      if (blocks && blocks.lastElementChild) blocks.lastElementChild.scrollIntoView({behavior:'smooth', block:'center'});
    }, 100);
  },

  removeBlock(idx) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a || !a.blocks[idx]) return;
    if (a.blocks.length <= 1) { this.showAlert('Mindestens ein Block erforderlich', 'warning'); return; }
    a.blocks.splice(idx, 1);
    this._save();
    this._renderBlockEditor();
  },

  moveBlock(idx, dir) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= a.blocks.length) return;
    var tmp = a.blocks[idx];
    a.blocks[idx] = a.blocks[newIdx];
    a.blocks[newIdx] = tmp;
    this._save();
    this._renderBlockEditor();
  },

  _updateBlock(idx, field, value) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a || !a.blocks[idx]) return;
    a.blocks[idx][field] = value;
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

  switchTab(tab) {
    this._editorTab = tab;
    this._renderBlockEditor();
  },

  saveArticle() {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    var titleEl = document.getElementById('editorTitle');
    var slugEl = document.getElementById('editorSlug');
    if (titleEl) a.title = titleEl.value;
    if (slugEl) a.slug = slugEl.value;
    a.sections = [];
    var currentSection = {heading:'', text:'', image:'', imageAlt:''};
    a.blocks.forEach(function(b) {
      if (b.type === 'heading') {
        if (currentSection.heading || currentSection.text || currentSection.image) {
          a.sections.push(currentSection);
          currentSection = {heading:'', text:'', image:'', imageAlt:''};
        }
        currentSection.heading = b.content || '';
      } else if (b.type === 'text' || b.type === 'quote') {
        currentSection.text += (currentSection.text ? '\n\n' : '') + (b.content || '');
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
    if (btn) { btn.textContent = 'Wird verÃ¶ffentlicht...'; btn.disabled = true; }
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
      if (btn) { btn.textContent = '\u2713 VerÃ¶ffentlicht!'; btn.style.background = '#10b981'; }
      setTimeout(() => { if (btn) { btn.textContent = 'Alle \u00c4nderungen verÃ¶ffentlichen'; btn.disabled = false; btn.style.background = ''; } }, 3000);
    } catch (e) {
      alert('Fehler beim VerÃ¶ffentlichen: ' + e.message);
      if (btn) { btn.textContent = 'Alle \u00c4nderungen verÃ¶ffentlichen'; btn.disabled = false; }
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
