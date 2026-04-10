/* ============================================================
   admin-articles.js â Wissen/Artikel-Verwaltung fÃ¼r stockvideo.de
   Version 2.0 â Listenansicht, Publish/Draft, Planungskalender
   ============================================================ */

const adminArticles = {
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
          <div class="aa-stat aa-stat-green"><span class="aa-stat-num">${published}</span><span class="aa-stat-label">Ãffentlich</span></div>
          <div class="aa-stat aa-stat-yellow"><span class="aa-stat-num">${scheduled}</span><span class="aa-stat-label">Geplant</span></div>
          <div class="aa-stat aa-stat-gray"><span class="aa-stat-num">${drafts}</span><span class="aa-stat-label">Entwurf</span></div>
        </div>
      </div>

      <div class="aa-layout">
        <div class="aa-list-section">
          <div class="aa-filter-bar">
            <button class="aa-filter active" data-filter="all" onclick="adminArticles.filterList('all',this)">Alle</button>
            <button class="aa-filter" data-filter="published" onclick="adminArticles.filterList('published',this)">Ãffentlich</button>
            <button class="aa-filter" data-filter="scheduled" onclick="adminArticles.filterList('scheduled',this)">Geplant</button>
            <button class="aa-filter" data-filter="draft" onclick="adminArticles.filterList('draft',this)">Entwurf</button>
          </div>
          <div class="aa-article-list" id="aa-article-list">
            ${this._renderArticleRows('all')}
          </div>
        </div>

        <div class="aa-calendar-section">
          <h3>Redaktionskalender</h3>
          <div class="aa-cal-nav">
            <button onclick="adminArticles.calPrev()">&laquo;</button>
            <span id="aa-cal-title">${this._monthName(this.calendarMonth)} ${this.calendarYear}</span>
            <button onclick="adminArticles.calNext()">&raquo;</button>
          </div>
          <div class="aa-calendar" id="aa-calendar">
            ${this._renderCalendar()}
          </div>
          <div class="aa-cal-legend">
            <span class="aa-cal-dot aa-dot-green"></span> Ãffentlich
            <span class="aa-cal-dot aa-dot-yellow"></span> Geplant
          </div>
          <div class="aa-upcoming" id="aa-upcoming">
            ${this._renderUpcoming()}
          </div>
        </div>
      </div>

      <div class="aa-actions-bottom">
        <button class="aa-btn aa-btn-save" onclick="adminArticles.publishToGitHub()">Alle Ãnderungen verÃ¶ffentlichen</button>
      </div>
    `;
  },

  _renderArticleRows(filter) {
    let list = this.articles;
    if (filter !== 'all') list = list.filter(a => a.status === filter);
    if (!list.length) return '<div class="aa-empty">Keine Artikel in dieser Kategorie</div>';

    return list.map(a => {
      const statusClass = a.status === 'published' ? 'aa-status-published' : a.status === 'scheduled' ? 'aa-status-scheduled' : 'aa-status-draft';
      const statusLabel = a.status === 'published' ? 'Ãffentlich' : a.status === 'scheduled' ? 'Geplant' : 'Entwurf';
      const statusIcon = a.status === 'published' ? 'â' : a.status === 'scheduled' ? 'â' : 'â';
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
            <label class="aa-toggle" title="Ãffentlich / Entwurf">
              <input type="checkbox" ${a.status === 'published' ? 'checked' : ''} onchange="adminArticles.toggleStatus('${a.id}', this.checked)">
              <span class="aa-toggle-slider"></span>
            </label>
            <button class="aa-btn-icon" title="Planen" onclick="adminArticles.openScheduler('${a.id}')">ð</button>
            <button class="aa-btn-icon" title="Bearbeiten" onclick="adminArticles.openEditor('${a.id}')">âï¸</button>
            <button class="aa-btn-icon aa-btn-danger" title="LÃ¶schen" onclick="adminArticles.deleteArticle('${a.id}')">ðï¸</button>
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
    const a = this.articles.find(x => x.id === id);
    if (!a) return;
    a.status = isPublished ? 'published' : 'draft';
    if (isPublished) a.scheduledDate = null;
    this._save();
    this.renderList();
  },

  /* ---------- SCHEDULER ---------- */
  openScheduler(id) {
    const a = this.articles.find(x => x.id === id);
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
    const a = this.articles.find(x => x.id === id);
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
    const a = this.articles.find(x => x.id === id);
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
    const a = this.articles.find(x => x.id === id);
    if (!a) return;
    if (!confirm('Artikel "' + (a.title || a.seoTitle) + '" wirklich lÃ¶schen?')) return;
    this.articles = this.articles.filter(x => x.id !== id);
    this._save();
    this.renderList();
  },

  /* ---------- EDITOR ---------- */
  openEditor(id) {
    const a = this.articles.find(x => x.id === id);
    if (!a) return;
    this.currentEditId = id;
    const c = document.getElementById('panel-articles');

    c.innerHTML = `
      <div class="aa-editor">
        <div class="aa-editor-header">
          <button class="aa-btn" onclick="adminArticles.closeEditor()">â ZurÃ¼ck zur Liste</button>
          <h2>Artikel bearbeiten</h2>
          <button class="aa-btn aa-btn-primary" onclick="adminArticles.saveArticle()">Speichern</button>
        </div>
        <div class="aa-editor-tabs">
          <button class="aa-tab active" onclick="adminArticles.switchTab('content',this)">Inhalt</button>
          <button class="aa-tab" onclick="adminArticles.switchTab('sections',this)">Abschnitte</button>
          <button class="aa-tab" onclick="adminArticles.switchTab('seo',this)">SEO</button>
          <button class="aa-tab" onclick="adminArticles.switchTab('settings',this)">Einstellungen</button>
        </div>
        <div class="aa-tab-content" id="aa-tab-content">${this._renderContentTab(a)}</div>
        <div class="aa-tab-content" id="aa-tab-sections" style="display:none">${this._renderSectionsTab(a)}</div>
        <div class="aa-tab-content" id="aa-tab-seo" style="display:none">${this._renderSeoTab(a)}</div>
        <div class="aa-tab-content" id="aa-tab-settings" style="display:none">${this._renderSettingsTab(a)}</div>
      </div>`;
  },

  switchTab(tab, btn) {
    document.querySelectorAll('.aa-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    ['content','sections','seo','settings'].forEach(t => {
      const el = document.getElementById('aa-tab-' + t);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
  },

  _renderContentTab(a) {
    return `
      <div class="aa-form">
        <div class="aa-field">
          <label>Titel</label>
          <input type="text" id="aa-title" value="${this._esc(a.title)}" placeholder="Artikel-Titel" oninput="adminArticles._autoSlug()">
        </div>
        <div class="aa-field-row">
          <div class="aa-field">
            <label>Slug</label>
            <input type="text" id="aa-slug" value="${this._esc(a.slug)}" placeholder="url-slug">
          </div>
          <div class="aa-field">
            <label>Kategorie</label>
            <select id="aa-category">
              ${['Grundlagen','Produktion','Marketing','Recht','Technologie','Business','Branche'].map(c => `<option${a.category===c?' selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="aa-field">
          <label>Einleitung</label>
          <textarea id="aa-intro" rows="4" placeholder="Einleitungstext...">${this._esc(a.intro)}</textarea>
        </div>
        <div class="aa-field">
          <label>Fazit / Abschluss</label>
          <textarea id="aa-conclusion" rows="3" placeholder="Fazit...">${this._esc(a.conclusion || '')}</textarea>
        </div>
      </div>`;
  },

  _renderSectionsTab(a) {
    const sections = (a.sections || []).map((s, i) => `
      <div class="aa-section-card" data-idx="${i}">
        <div class="aa-section-head">
          <span class="aa-section-num">H2 #${i+1}</span>
          <input type="text" class="aa-section-heading" value="${this._esc(s.heading)}" placeholder="Ãberschrift">
          <button class="aa-btn-icon aa-btn-danger" onclick="adminArticles.removeSection(${i})">â</button>
        </div>
        <div class="aa-section-body">
          ${(s.paragraphs || []).map((p, pi) => `
            <div class="aa-para-wrap">
              <textarea class="aa-section-para" rows="4" data-si="${i}" data-pi="${pi}" placeholder="Absatz ${pi+1}...">${this._esc(p)}</textarea>
              <button class="aa-btn-icon aa-btn-danger" onclick="adminArticles.removeParagraph(${i},${pi})">â</button>
            </div>`).join('')}
          <button class="aa-btn aa-btn-sm" onclick="adminArticles.addParagraph(${i})">+ Absatz</button>
        </div>
      </div>`).join('');
    return `
      <div class="aa-sections">
        ${sections || '<div class="aa-empty">Noch keine Abschnitte</div>'}
        <button class="aa-btn aa-btn-primary" onclick="adminArticles.addSection()">+ Neuer Abschnitt (H2)</button>
      </div>`;
  },

  _renderSeoTab(a) {
    return `
      <div class="aa-form">
        <div class="aa-field">
          <label>Keyphrase</label>
          <input type="text" id="aa-keyphrase" value="${this._esc(a.keyphrase || '')}" placeholder="Haupt-Keyphrase">
        </div>
        <div class="aa-field">
          <label>SEO-Titel <span class="aa-char-count" id="aa-seo-title-count"></span></label>
          <input type="text" id="aa-seoTitle" value="${this._esc(a.seoTitle || '')}" placeholder="SEO-Titel (50-60 Zeichen)" oninput="adminArticles._updateCount('seoTitle',50,60)">
        </div>
        <div class="aa-field">
          <label>Meta-Description <span class="aa-char-count" id="aa-meta-count"></span></label>
          <textarea id="aa-metaDescription" rows="2" placeholder="150-160 Zeichen" oninput="adminArticles._updateCount('metaDescription',150,160)">${this._esc(a.metaDescription || '')}</textarea>
        </div>
        <div class="aa-field">
          <label>Interne Links (URLs, je Zeile eine)</label>
          <textarea id="aa-internalLinks" rows="3" placeholder="/wissen/slug-1/&#10;/video/slug-2/">${(a.internalLinks||[]).map(l=>typeof l==='string'?l:l.url||'').join('\n')}</textarea>
        </div>
        <div class="aa-field">
          <label>Wikipedia-Quelle</label>
          <input type="text" id="aa-wikiUrl" value="${this._esc(a.wikipediaUrl || '')}" placeholder="https://de.wikipedia.org/wiki/...">
        </div>
      </div>`;
  },

  _renderSettingsTab(a) {
    return `
      <div class="aa-form">
        <div class="aa-field-row">
          <div class="aa-field">
            <label>Lesezeit (Min.)</label>
            <input type="number" id="aa-readTime" value="${a.readTime || 8}" min="1" max="60">
          </div>
          <div class="aa-field">
            <label>Kategorie-Farbe</label>
            <input type="color" id="aa-catColor" value="${a.categoryColor || '#1473e6'}">
          </div>
        </div>
        <div class="aa-field">
          <label>Hero-Bild Alt-Text</label>
          <input type="text" id="aa-imageAlt" value="${this._esc(a.imageAlt || '')}" placeholder="Bildbeschreibung">
        </div>
        <div class="aa-field-row">
          <div class="aa-field"><label>Geo-Lat</label><input type="text" id="aa-geoLat" value="${a.imageGeoLat||''}"></div>
          <div class="aa-field"><label>Geo-Lng</label><input type="text" id="aa-geoLng" value="${a.imageGeoLng||''}"></div>
          <div class="aa-field"><label>Geo-Stadt</label><input type="text" id="aa-geoCity" value="${this._esc(a.imageGeoCity||'')}"></div>
        </div>
        <div class="aa-field">
          <label>Wikipedia Ankertext</label>
          <input type="text" id="aa-wikiAnchor" value="${this._esc(a.wikipediaAnchor||'')}">
        </div>
      </div>`;
  },

  _autoSlug() {
    const title = document.getElementById('aa-title')?.value || '';
    const slug = title.toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[Ã¤Ã]/g,'ae').replace(/[Ã¶Ã]/g,'oe').replace(/[Ã¼Ã]/g,'ue').replace(/Ã/g,'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const el = document.getElementById('aa-slug');
    if (el && !el.dataset.manual) el.value = slug;
  },

  _updateCount(field, min, max) {
    const el = document.getElementById('aa-' + field);
    const countEl = document.getElementById(field === 'seoTitle' ? 'aa-seo-title-count' : 'aa-meta-count');
    if (!el || !countEl) return;
    const len = el.value.length;
    const color = len >= min && len <= max ? '#10b981' : len > 0 ? '#ef4444' : '#888';
    countEl.textContent = `${len}/${min}-${max}`;
    countEl.style.color = color;
  },

  /* ---------- SECTION MANAGEMENT ---------- */
  addSection() {
    this._collectEditorData();
    const a = this.articles.find(x => x.id === this.currentEditId);
    if (!a) return;
    a.sections.push({ heading: '', paragraphs: [''] });
    this._save();
    document.getElementById('aa-tab-sections').innerHTML = this._renderSectionsTab(a);
  },

  removeSection(idx) {
    this._collectEditorData();
    const a = this.articles.find(x => x.id === this.currentEditId);
    if (!a) return;
    a.sections.splice(idx, 1);
    this._save();
    document.getElementById('aa-tab-sections').innerHTML = this._renderSectionsTab(a);
  },

  addParagraph(sIdx) {
    this._collectEditorData();
    const a = this.articles.find(x => x.id === this.currentEditId);
    if (!a) return;
    a.sections[sIdx].paragraphs.push('');
    this._save();
    document.getElementById('aa-tab-sections').innerHTML = this._renderSectionsTab(a);
  },

  removeParagraph(sIdx, pIdx) {
    this._collectEditorData();
    const a = this.articles.find(x => x.id === this.currentEditId);
    if (!a) return;
    a.sections[sIdx].paragraphs.splice(pIdx, 1);
    this._save();
    document.getElementById('aa-tab-sections').innerHTML = this._renderSectionsTab(a);
  },

  /* ---------- SAVE ---------- */
  _collectEditorData() {
    const a = this.articles.find(x => x.id === this.currentEditId);
    if (!a) return;
    const v = id => document.getElementById(id)?.value || '';
    a.title = v('aa-title');
    a.slug = v('aa-slug');
    a.category = v('aa-category');
    a.intro = v('aa-intro');
    a.conclusion = v('aa-conclusion');
    a.keyphrase = v('aa-keyphrase');
    a.seoTitle = v('aa-seoTitle');
    a.metaDescription = v('aa-metaDescription');
    a.readTime = parseInt(v('aa-readTime')) || 8;
    a.categoryColor = v('aa-catColor');
    a.imageAlt = v('aa-imageAlt');
    a.imageGeoLat = v('aa-geoLat');
    a.imageGeoLng = v('aa-geoLng');
    a.imageGeoCity = v('aa-geoCity');
    a.wikipediaUrl = v('aa-wikiUrl');
    a.wikipediaAnchor = v('aa-wikiAnchor');
    const linksRaw = v('aa-internalLinks');
    a.internalLinks = linksRaw.split('\n').map(l => l.trim()).filter(Boolean);
    // Collect sections from DOM
    document.querySelectorAll('.aa-section-card').forEach((card, i) => {
      if (!a.sections[i]) a.sections[i] = { heading: '', paragraphs: [] };
      a.sections[i].heading = card.querySelector('.aa-section-heading')?.value || '';
      const paras = card.querySelectorAll('.aa-section-para');
      a.sections[i].paragraphs = Array.from(paras).map(t => t.value);
    });
  },

  saveArticle() {
    this._collectEditorData();
    this._save();
    const toast = document.createElement('div');
    toast.className = 'aa-toast';
    toast.textContent = 'Artikel gespeichert!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  },

  closeEditor() {
    if (this.currentEditId) this._collectEditorData();
    this._save();
    this.currentEditId = null;
    this.renderList();
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
      if (btn) { btn.textContent = 'â VerÃ¶ffentlicht!'; btn.style.background = '#10b981'; }
      setTimeout(() => { if (btn) { btn.textContent = 'Alle Ãnderungen verÃ¶ffentlichen'; btn.disabled = false; btn.style.background = ''; } }, 3000);
    } catch (e) {
      alert('Fehler beim VerÃ¶ffentlichen: ' + e.message);
      if (btn) { btn.textContent = 'Alle Ãnderungen verÃ¶ffentlichen'; btn.disabled = false; }
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
    // Extract panel name - could be string or event
    let name;
    if (typeof nameOrEvent === 'string') {
      name = nameOrEvent;
    } else if (nameOrEvent && nameOrEvent.currentTarget) {
      const el = nameOrEvent.currentTarget;
      name = el.getAttribute('data-panel') || el.textContent.trim().toLowerCase();
    } else {
      name = nameOrEvent;
    }

    if (name === 'articles') {
      // Handle articles panel ourselves
      document.querySelectorAll('[id^="panel-"]').forEach(p => {
        p.style.display = p.id === 'panel-articles' ? 'block' : 'none';
      });
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => {
        if (n.textContent.includes('Wissen') || n.textContent.includes('Artikel')) {
          n.classList.add('active');
        }
      });
      adminArticles.init();
    } else {
      // For other panels, call original but pass the event/name properly
      try {
        origSwitch(nameOrEvent);
      } catch(e) {
        // Fallback: handle panel switch manually
        document.querySelectorAll('[id^="panel-"]').forEach(p => {
          p.style.display = p.id === 'panel-' + name ? 'block' : 'none';
        });
      }
    }
  };
})();
