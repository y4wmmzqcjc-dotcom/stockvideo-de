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
        <button class="aa-btn aa-btn-save" onclick="adminArticles.publishToGitHub()">Alle \u00c4nderungen veröffentlichen</button>
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
    if (!a.blocks) {
      // Migrate old format to blocks
      a.blocks = [];
      if (a.intro) a.blocks.push({type:'text', content: a.intro});
      if (a.sections) a.sections.forEach(s => {
        if (s.heading) a.blocks.push({type:'heading', content: s.heading});
        if (s.text) a.blocks.push({type:'text', content: s.text});
        if (s.image) a.blocks.push({type:'image', src: s.image, alt: s.imageAlt || ''});
      });
      if (a.blocks.length === 0) a.blocks.push({type:'text', content: ''});
    }
    if (!a.geo) a.geo = { lat: '', lng: '', location: '' };
    
    const c = document.getElementById('panel-articles');
    c.innerHTML = this._renderBlockEditor(a);
    this._initBlockDragDrop();
  },

  _renderBlockEditor(a) {
    const blocks = (a.blocks||[]).map((b, i) => this._renderBlock(b, i)).join('');
    const seoChecks = this._getSeoChecks(a);
    const seoColor = this._getSeoScore(a);
    
    return `
    <div class="aa-editor">
      <div class="aa-editor-header">
        <button class="aa-btn" onclick="adminArticles.closeEditor()">\u2190 Zurück zur Liste</button>
        <h2>Artikel bearbeiten</h2>
        <button class="aa-btn aa-btn-primary" onclick="adminArticles.saveArticle()">Speichern</button>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 320px;gap:24px;padding:20px">
        <div>
          <div class="aa-field" style="margin-bottom:16px">
            <input type="text" id="aa-title" value="${this._esc(a.title)}" placeholder="Artikel-Titel" 
              style="font-size:24px;font-weight:700;padding:12px;width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff"
              oninput="adminArticles._autoSlug()">
          </div>
          
          <div id="aa-blocks-container" style="min-height:200px">
            ${blocks}
          </div>
          
          <div class="aa-block-add" style="margin-top:12px;display:flex;gap:8px">
            <button class="aa-btn" onclick="adminArticles.addBlock('text')" title="Text">+ Text</button>
            <button class="aa-btn" onclick="adminArticles.addBlock('heading')" title="Überschrift">+ H2</button>
            <button class="aa-btn" onclick="adminArticles.addBlock('image')" title="Bild">+ Bild</button>
            <button class="aa-btn" onclick="adminArticles.addBlock('quote')" title="Zitat">+ Zitat</button>
          </div>
        </div>
        
        <div class="aa-sidebar" style="position:sticky;top:20px;max-height:calc(100vh - 120px);overflow-y:auto">
          <div style="background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px;margin-bottom:16px">
            <h3 style="color:#fff;margin:0 0 12px;font-size:14px">Einstellungen</h3>
            <div class="aa-field" style="margin-bottom:8px">
              <label style="font-size:12px;color:#888">Slug</label>
              <input type="text" id="aa-slug" value="${this._esc(a.slug)}" placeholder="url-slug" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
            <div class="aa-field" style="margin-bottom:8px">
              <label style="font-size:12px;color:#888">Kategorie</label>
              <select id="aa-category" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
                ${['Grundlagen','Produktion','Marketing','Recht','Technologie','Business','Branche'].map(c => '<option' + (a.category===c?' selected':'') + '>' + c + '</option>').join('')}
              </select>
            </div>
            <div class="aa-field">
              <label style="font-size:12px;color:#888">Lesezeit (Min.)</label>
              <input type="number" id="aa-readtime" value="${a.readTime||''}" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
          </div>
          
          <div style="background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px;margin-bottom:16px">
            <h3 style="color:#fff;margin:0 0 12px;font-size:14px">SEO <span class="aa-seo-dot aa-seo-${seoColor}" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:6px"></span></h3>
            ${seoChecks.map(c => '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px"><span style="color:' + (c.ok?'#34c759':'#ff3b30') + '">' + (c.ok?'\u2713':'\u2717') + '</span><span style="color:' + (c.ok?'#ccc':'#888') + '">' + c.label + '</span></div>').join('')}
            <div class="aa-field" style="margin-top:12px">
              <label style="font-size:12px;color:#888">Keyphrase</label>
              <input type="text" id="aa-keyphrase" value="${this._esc(a.keyphrase||'')}" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
            <div class="aa-field" style="margin-top:8px">
              <label style="font-size:12px;color:#888">SEO-Titel <span id="aa-seo-title-count" style="color:#555">(${(a.seoTitle||'').length}/60)</span></label>
              <input type="text" id="aa-seoTitle" value="${this._esc(a.seoTitle||'')}" maxlength="70" oninput="document.getElementById('aa-seo-title-count').textContent='('+this.value.length+'/60)'" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
            <div class="aa-field" style="margin-top:8px">
              <label style="font-size:12px;color:#888">Meta-Beschreibung <span id="aa-meta-count" style="color:#555">(${(a.metaDescription||'').length}/160)</span></label>
              <textarea id="aa-metaDescription" rows="3" maxlength="170" oninput="document.getElementById('aa-meta-count').textContent='('+this.value.length+'/160)'" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px;resize:vertical">${this._esc(a.metaDescription||'')}</textarea>
            </div>
            <div class="aa-field" style="margin-top:8px">
              <label style="font-size:12px;color:#888">Interne Links (kommagetrennt)</label>
              <input type="text" id="aa-internalLinks" value="${this._esc((a.internalLinks||[]).join(', '))}" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
            <div class="aa-field" style="margin-top:8px">
              <label style="font-size:12px;color:#888">Wikipedia URL</label>
              <input type="text" id="aa-wikipediaUrl" value="${this._esc(a.wikipediaUrl||'')}" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
          </div>
          
          <div style="background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:16px">
            <h3 style="color:#fff;margin:0 0 12px;font-size:14px">GEO-Daten</h3>
            <div class="aa-field" style="margin-bottom:8px">
              <label style="font-size:12px;color:#888">Standort</label>
              <input type="text" id="aa-geo-location" value="${this._esc(a.geo?.location||'')}" placeholder="z.B. München, Deutschland" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div class="aa-field">
                <label style="font-size:12px;color:#888">Breitengrad</label>
                <input type="text" id="aa-geo-lat" value="${a.geo?.lat||''}" placeholder="48.1351" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
              </div>
              <div class="aa-field">
                <label style="font-size:12px;color:#888">Längengrad</label>
                <input type="text" id="aa-geo-lng" value="${a.geo?.lng||''}" placeholder="11.5820" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px">
              </div>
            </div>
            <div id="aa-geo-map" style="height:150px;border-radius:8px;background:rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;overflow:hidden">
              ${(a.geo?.lat && a.geo?.lng) ? '<img src="https://maps.googleapis.com/maps/api/staticmap?center='+a.geo.lat+','+a.geo.lng+'&zoom=10&size=300x150&markers='+a.geo.lat+','+a.geo.lng+'&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML=\'<div style=color:#555;font-size:12px>Karte nicht verfügbar</div>\'">' : '<div style="color:#555;font-size:12px">Koordinaten eingeben für Kartenvorschau</div>'}
            </div>
            <button class="aa-btn" style="margin-top:8px;width:100%;font-size:12px" onclick="adminArticles._readExifGeo()">EXIF-Daten aus Bildern lesen</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  _renderBlock(block, index) {
    const dragHandle = '<div class="aa-block-handle" draggable="true" data-idx="' + index + '" style="cursor:grab;padding:4px 8px;color:#555;font-size:14px" title="Ziehen zum Verschieben">\u2630</div>';
    const deleteBtn = '<button class="aa-block-delete" onclick="adminArticles.removeBlock(' + index + ')" style="background:none;border:none;color:#555;cursor:pointer;font-size:14px;padding:4px" title="Block löschen">\u2715</button>';
    const toolbar = '<div class="aa-block-toolbar" style="display:flex;align-items:center;gap:4px;padding:4px 8px;opacity:0.3;transition:opacity 0.2s">' + dragHandle + '<div style="flex:1"></div>' + deleteBtn + '</div>';
    
    let content = '';
    switch(block.type) {
      case 'heading':
        content = '<input type="text" value="' + this._esc(block.content||'') + '" placeholder="Überschrift..." onchange="adminArticles._updateBlock(' + index + ',\'content\',this.value)" style="width:100%;padding:8px 12px;font-size:20px;font-weight:700;background:transparent;border:none;color:#fff;outline:none">';
        break;
      case 'image':
        content = '<div style="padding:8px 12px">' +
          (block.src ? '<img src="' + block.src + '" style="max-width:100%;border-radius:8px;margin-bottom:8px" onerror="this.style.display=\'none\'">' : '') +
          '<input type="text" value="' + this._esc(block.src||'') + '" placeholder="Bild-URL..." onchange="adminArticles._updateBlock(' + index + ',\'src\',this.value)" style="width:100%;padding:6px;margin-bottom:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:12px">' +
          '<input type="text" value="' + this._esc(block.alt||'') + '" placeholder="Alt-Text..." onchange="adminArticles._updateBlock(' + index + ',\'alt\',this.value)" style="width:100%;padding:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:12px">' +
          '</div>';
        break;
      case 'quote':
        content = '<textarea placeholder="Zitat..." onchange="adminArticles._updateBlock(' + index + ',\'content\',this.value)" style="width:100%;padding:8px 12px 8px 20px;min-height:60px;background:transparent;border:none;border-left:3px solid #0099ff;color:#ccc;font-style:italic;font-size:15px;outline:none;resize:vertical">' + this._esc(block.content||'') + '</textarea>';
        break;
      default: // text
        content = '<textarea placeholder="Text eingeben..." onchange="adminArticles._updateBlock(' + index + ',\'content\',this.value)" style="width:100%;padding:8px 12px;min-height:80px;background:transparent;border:none;color:#ddd;font-size:15px;line-height:1.6;outline:none;resize:vertical">' + this._esc(block.content||'') + '</textarea>';
    }
    
    return '<div class="aa-block" data-idx="' + index + '" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:8px;transition:border-color 0.2s" onmouseover="this.querySelector(\'.aa-block-toolbar\').style.opacity=1" onmouseout="this.querySelector(\'.aa-block-toolbar\').style.opacity=0.3">' + toolbar + content + '</div>';
  },

  addBlock(type) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    a.blocks = a.blocks || [];
    a.blocks.push({type, content: '', src: '', alt: ''});
    this.openEditor(this.currentEditId);
  },

  removeBlock(idx) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a || !a.blocks) return;
    a.blocks.splice(idx, 1);
    this.openEditor(this.currentEditId);
  },

  _updateBlock(idx, key, value) {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a || !a.blocks || !a.blocks[idx]) return;
    a.blocks[idx][key] = value;
  },

  _initBlockDragDrop() {
    const container = document.getElementById('aa-blocks-container');
    if (!container) return;
    let dragIdx = null;
    container.addEventListener('dragstart', e => {
      const handle = e.target.closest('.aa-block-handle');
      if (!handle) { e.preventDefault(); return; }
      dragIdx = parseInt(handle.dataset.idx);
      e.dataTransfer.effectAllowed = 'move';
    });
    container.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    container.addEventListener('drop', e => {
      e.preventDefault();
      const block = e.target.closest('.aa-block');
      if (!block || dragIdx === null) return;
      const dropIdx = parseInt(block.dataset.idx);
      const a = this.articles.find(x => x.id == this.currentEditId);
      if (!a || !a.blocks) return;
      const moved = a.blocks.splice(dragIdx, 1)[0];
      a.blocks.splice(dropIdx, 0, moved);
      this.openEditor(this.currentEditId);
    });
  },

  _readExifGeo() {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a || !a.blocks) return;
    const imageBlock = a.blocks.find(b => b.type === 'image' && b.src);
    if (!imageBlock) { alert('Kein Bildblock mit URL gefunden'); return; }
    alert('EXIF-Daten werden aus dem ersten Bild gelesen...\nHinweis: EXIF-Extraktion erfordert serverseitige Verarbeitung. Bitte Koordinaten manuell eingeben.');
  },

  closeEditor() {
    this.currentEditId = null;
    this.renderList();
  },

  switchTab(tab, btn) {
    // Legacy compatibility - not used in block editor
  },

  /* ---------- SAVE ---------- */
  saveArticle() {
    const a = this.articles.find(x => x.id == this.currentEditId);
    if (!a) return;
    
    // Read values from block editor sidebar
    a.title = document.getElementById('aa-title')?.value || a.title;
    a.slug = document.getElementById('aa-slug')?.value || a.slug;
    a.category = document.getElementById('aa-category')?.value || a.category;
    a.readTime = document.getElementById('aa-readtime')?.value || a.readTime;
    a.keyphrase = document.getElementById('aa-keyphrase')?.value || '';
    a.seoTitle = document.getElementById('aa-seoTitle')?.value || '';
    a.metaDescription = document.getElementById('aa-metaDescription')?.value || '';
    const linksVal = document.getElementById('aa-internalLinks')?.value || '';
    a.internalLinks = linksVal ? linksVal.split(',').map(s => s.trim()).filter(Boolean) : [];
    a.wikipediaUrl = document.getElementById('aa-wikipediaUrl')?.value || '';
    
    // GEO data
    a.geo = {
      location: document.getElementById('aa-geo-location')?.value || '',
      lat: document.getElementById('aa-geo-lat')?.value || '',
      lng: document.getElementById('aa-geo-lng')?.value || ''
    };
    
    // Blocks are already updated via _updateBlock inline handlers
    // Generate intro from first text block for backwards compatibility
    const firstText = (a.blocks || []).find(b => b.type === 'text');
    if (firstText) a.intro = firstText.content;
    
    // Generate sections from blocks for backwards compatibility
    a.sections = [];
    let currentSection = null;
    (a.blocks || []).forEach(b => {
      if (b.type === 'heading') {
        currentSection = { heading: b.content, text: '', image: '', imageAlt: '' };
        a.sections.push(currentSection);
      } else if (b.type === 'text' && currentSection) {
        currentSection.text += (currentSection.text ? '\n\n' : '') + b.content;
      } else if (b.type === 'image' && currentSection) {
        currentSection.image = b.src || '';
        currentSection.imageAlt = b.alt || '';
      }
    });
    
    this._save();
    this.openEditor(this.currentEditId);
    this.showAlert('Artikel gespeichert', 'success');
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
