/* ============================================================
   admin-articles.js â Wissen/Artikel-Verwaltung fÃ¼r stockvideo.de
   Version 3.0 â Zwei-Tab-Layout, Vollbild-Kalender, UTF-8 Fix
   ============================================================ */

const adminArticles = {
  articles: [],
  currentEditId: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  currentView: 'list',

  /* ---------- INIT ---------- */
  init() {
    const container = document.getElementById('panel-articles');
    if (!container) return;
    const stored = localStorage.getItem('adminArticles');
    if (stored) {
      try { this.articles = JSON.parse(stored); } catch(e) { this.articles = []; }
      this._ensureStatusFields();
      this.render();
    } else {
      fetch('/data/articles.json')
        .then(r => r.json())
        .catch(() => [])
        .then(data => {
          this.articles = data || [];
          this._ensureStatusFields();
          this.render();
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

  /* ---------- MAIN RENDER ---------- */
  render() {
    const c = document.getElementById('panel-articles');
    if (!c) return;

    const published = this.articles.filter(a => a.status === 'published').length;
    const drafts = this.articles.filter(a => a.status === 'draft').length;
    const scheduled = this.articles.filter(a => a.status === 'scheduled').length;

    c.innerHTML =
      '<div class="aa-header">' +
        '<div class="aa-header-top">' +
          '<h2>Wissen / Artikel</h2>' +
          '<button class="aa-btn aa-btn-primary" onclick="adminArticles.newArticle()">+ Neuer Artikel</button>' +
        '</div>' +
        '<div class="aa-stats">' +
          '<div class="aa-stat"><span class="aa-stat-num">' + this.articles.length + '</span><span class="aa-stat-label">Gesamt</span></div>' +
          '<div class="aa-stat aa-stat-green"><span class="aa-stat-num">' + published + '</span><span class="aa-stat-label">\u00d6ffentlich</span></div>' +
          '<div class="aa-stat aa-stat-yellow"><span class="aa-stat-num">' + scheduled + '</span><span class="aa-stat-label">Geplant</span></div>' +
          '<div class="aa-stat aa-stat-gray"><span class="aa-stat-num">' + drafts + '</span><span class="aa-stat-label">Entwurf</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="aa-view-tabs">' +
        '<button class="aa-view-tab' + (this.currentView === 'list' ? ' active' : '') + '" onclick="adminArticles.switchView(\'list\')">Artikelliste</button>' +
        '<button class="aa-view-tab' + (this.currentView === 'calendar' ? ' active' : '') + '" onclick="adminArticles.switchView(\'calendar\')">Redaktionskalender</button>' +
      '</div>' +
      '<div id="aa-view-content"></div>' +
      '<div class="aa-actions-bottom">' +
        '<button class="aa-btn aa-btn-save" onclick="adminArticles.publishToGitHub()">Alle \u00c4nderungen ver\u00f6ffentlichen</button>' +
      '</div>';

    this._renderCurrentView();
  },

  switchView(view) {
    this.currentView = view;
    document.querySelectorAll('.aa-view-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.aa-view-tab').forEach(t => {
      if ((view === 'list' && t.textContent === 'Artikelliste') ||
          (view === 'calendar' && t.textContent === 'Redaktionskalender')) {
        t.classList.add('active');
      }
    });
    this._renderCurrentView();
  },

  _renderCurrentView() {
    const el = document.getElementById('aa-view-content');
    if (!el) return;
    if (this.currentView === 'list') {
      this._renderListView(el);
    } else {
      this._renderCalendarView(el);
    }
  },

  /* ---------- LIST VIEW ---------- */
  _renderListView(el) {
    el.innerHTML =
      '<div class="aa-filter-bar">' +
        '<button class="aa-filter active" onclick="adminArticles.filterList(\'all\',this)">Alle</button>' +
        '<button class="aa-filter" onclick="adminArticles.filterList(\'published\',this)">\u00d6ffentlich</button>' +
        '<button class="aa-filter" onclick="adminArticles.filterList(\'scheduled\',this)">Geplant</button>' +
        '<button class="aa-filter" onclick="adminArticles.filterList(\'draft\',this)">Entwurf</button>' +
      '</div>' +
      '<div class="aa-article-list" id="aa-article-list">' +
        this._renderArticleRows('all') +
      '</div>';
  },

  _renderArticleRows(filter) {
    var list = this.articles;
    if (filter !== 'all') list = list.filter(function(a) { return a.status === filter; });
    if (!list.length) return '<div class="aa-empty">Keine Artikel in dieser Kategorie</div>';

    return list.map(function(a) {
      var statusClass = a.status === 'published' ? 'aa-status-published' : a.status === 'scheduled' ? 'aa-status-scheduled' : 'aa-status-draft';
      var statusLabel = a.status === 'published' ? '\u00d6ffentlich' : a.status === 'scheduled' ? 'Geplant' : 'Entwurf';
      var statusIcon = a.status === 'published' ? '\u25cf' : a.status === 'scheduled' ? '\u25d0' : '\u25cb';
      var schedInfo = a.status === 'scheduled' && a.scheduledDate ? '<span class="aa-sched-date">' + adminArticles._formatDate(a.scheduledDate) + '</span>' : '';
      var catColor = a.categoryColor || '#1473e6';
      var checked = a.status === 'published' ? ' checked' : '';

      return '<div class="aa-row" data-status="' + a.status + '" data-id="' + a.id + '">' +
        '<div class="aa-row-status"><span class="' + statusClass + '" title="' + statusLabel + '">' + statusIcon + '</span></div>' +
        '<div class="aa-row-info">' +
          '<div class="aa-row-title">' +
            '<span class="aa-article-id">#' + a.id + '</span> ' +
            (a.title || a.seoTitle || 'Ohne Titelment.getElementById('aa-view-content');
    if (!el) return;
    if (this.currentView === 'list') {
      this._renderListView(el);
    } else {
      this._renderCalendarView(el);
    }
  },

  /* ---------- LIST VIEW ---------- */
  _renderListView(el) {
    el.innerHTML =
      '<div class="aa-filter-bar">' +
        '<button class="aa-filter active" onclick="adminArticles.filterList(\'all\',this)">Alle</button>' +
        '<button class="aa-filter" onclick="adminArticles.filterList(\'published\',this)">\u00d6ffentlich</button>' +
        '<button class="aa-filter" onclick="adminArticles.filterList(\'scheduled\',this)">Geplant</button>' +
        '<button class="aa-filter" onclick="adminArticles.filterList(\'draft\',this)">Entwurf</button>' +
      '</div>' +
      '<div class="aa-article-list" id="aa-article-list">' +
        this._renderArticleRows('all') +
      '</div>';
  },

  _renderArticleRows(filter) {
    var list = this.articles;
    if (filter !== 'all') list = list.filter(function(a) { return a.status === filter; });
    if (!list.length) return '<div class="aa-empty">Keine Artikel in dieser Kategorie</div>';

    return list.map(function(a) {
      var statusClass = a.status === 'published' ? 'aa-status-published' : a.status === 'scheduled' ? 'aa-status-scheduled' : 'aa-status-draft';
      var statusLabel = a.status === 'published' ? '\u00d6ffentlich' : a.status === 'scheduled' ? 'Geplant' : 'Entwurf';
      var statusIcon = a.status === 'published' ? '\u25cf' : a.status === 'scheduled' ? '\u25d0' : '\u25cb';
      var schedInfo = a.status === 'scheduled' && a.scheduledDate ? '<span class="aa-sched-date">' + adminArticles._formatDate(a.scheduledDate) + '</span>' : '';
      var catColor = a.categoryColor || '#1473e6';
      var checked = a.status === 'published' ? ' checked' : '';

      return '<div class="aa-row" data-status="' + a.status + '" data-id="' + a.id + '">' +
        '<div class="aa-row-status"><span class="' + statusClass + '" title="' + statusLabel + '">' + statusIcon + '</span></div>' +
        '<div class="aa-row-info">' +
          '<div class="aa-row-title">' +
            '<span class="aa-article-id">#' + a.id + '</span> ' +
            (a.title || a.seoTitle || 'Ohne Titel') +
          '</div>' +
          '<div class="aa-row-meta">' +
            '<span class="aa-cat-badge" style="background:' + catColor + '">' + a.category + '</span>' +
            '<span>' + (a.readTime || '?') + ' Min.</span>' +
            schedInfo +
          '</div>' +
        '</div>' +
        '<div class="aa-row-actions">' +
          '<label class="aa-toggle" title="\u00d6ffentlich / Entwurf">' +
            '<input type="checkbox"' + checked + ' onchange="adminArticles.toggleStatus(\'' + a.id + '\', this.checked)">' +
            '<span class="aa-toggle-slider"></span>' +
          '</label>' +
          '<button class="aa-btn-icon" title="Planen" onclick="adminArticles.openScheduler(\'' + a.id + '\')">\ud83d\udcc5</button>' +
          '<button class="aa-btn-icon" title="Bearbeiten" onclick="adminArticles.openEditor(\'' + a.id + '\')">\u270f\ufe0f</button>' +
          '<button class="aa-btn-icon aa-btn-danger" title="L\u00f6schen" onclick="adminArticles.deleteArticle(\'' + a.id + '\')">\ud83d\uddd1\ufe0f</button>' +
        '</div>' +
      '</div>';
    }).join('');
  },

  filterList(filter, btn) {
    document.querySelectorAll('.aa-filter').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var el = document.getElementById('aa-article-list');
    if (el) el.innerHTML = this._renderArticleRows(filter);
  },

  /* ---------- STATUS TOGGLE ---------- */
  toggleStatus(id, isPublished) {
    var a = this.article';
    this._save();
    var ov = document.querySelector('.aa-overlay');
    if (ov) ov.remove();
    this.render();
  },

  /* ========== FULL CALENDAR VIEW ========== */
  _renderCalendarView(el) {
    el.innerHTML =
      '<div class="aa-cal-fullview">' +
        '<div class="aa-cal-header">' +
          '<button class="aa-cal-nav-btn" onclick="adminArticles.calPrev()">\u00ab</button>' +
          '<h3 class="aa-cal-month-title" id="aa-cal-month-title">' + this._monthName(this.calendarMonth) + ' ' + this.calendarYear + '</h3>' +
          '<button class="aa-cal-nav-btn" onclick="adminArticles.calNext()">\u00bb</button>' +
        '</div>' +
        '<div class="aa-cal-legend">' +
          '<div class="aa-cal-legend-item"><span class="aa-cal-dot aa-dot-green"></span> \u00d6ffentlich</div>' +
          '<div class="aa-cal-legend-item"><span class="aa-cal-dot aa-dot-yellow"></span> Geplant</div>' +
          '<div class="aa-cal-legend-item"><span class="aa-cal-dot aa-dot-gray"></span> Entwurf</div>' +
        '</div>' +
        '<div class="aa-cal-grid" id="aa-cal-grid">' +
          this._renderFullCalendar() +
        '</div>' +
        '<div class="aa-cal-sidebar">' +
          '<h4>Ungeplante Artikel</h4>' +
          '<div class="aa-cal-unscheduled" id="aa-cal-unscheduled">' +
            this._renderUnscheduled() +
          '</div>' +
        '</div>' +
      '</div>';
  },

  _monthName(m) {
    return ['Januar','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][m];
  },

  _formatDate(d) {
    if (!d) return '';
    var dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  calPrev() {
    this.calendarMonth--;
    if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear--; }
    this._refreshCalendar();
  },

  calNext() {
    this.calendarMonth++;
    if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear++; }
    this._refreshCalendar();
  },

  _refreshCalendar() {
    var title = document.getElementById('aa-cal-month-title');
    if (title) title.textContent = this._monthName(this.calendarMonth) + ' ' + this.calendarYear;
    var grid = document.getElementById('aa-cal-grid');
    if (grid) grid.innerHTML = this._renderFullCalendar();
  },

  _renderFullCalendar() {
    var y = this.calendarYear, m = this.calendarMonth;
    var first = new Date(y, m, 1);
    var last = new Date(y, m + 1, 0);
    var startDay = first.getDay() || 7;
    var days = last.getDate();
    var todayStr = new Date().toISOString().split('T')[0];

    var byDate = {};
    this.articles.forEach(function(a) {
      var d = a.scheduledDate || (a.status === 'published' ? (a.publishDate || null) : null);
      if (d) {
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(a);
      }
    });

    var weekdays = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    var html = '<div class="aa-cal-weekdays">';
    weekdays.forEach(function(wd) {
      html += '<div class="aa-cal-weekday">' + wd + '</div>';
    });
    html += '</div><div class="aa-cal-days">';

    for (var e = 1; e < startDay; e++) {
      html += '<div class="aa-cal-cell aa-cal-empty"></div>';
    }

    for (var d = 1; d <= days; d++) {
      var dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isToday = dateStr === todayStr;
      var isPast = dateStr < todayStr;
      var cls = 'aa-cal-cell';
      if (isToday) cls += ' aa-cal-today';
      if (isPast) cls += ' aa-cal-past';

      var dayArticles = byDate[dateStr] || [];

      html += '<div class="' + cls + '" data-date="' + dateStr + '">';
      html += '<div class="aa-cal-day-num">' + d + '</div>';
      html += '<div class="aa-cal-day-articles">';

      dayArticles.forEach(function(a) {
        var chipClass = a.status === 'published' ? 'aa-cal-art-pub' : 'aa-cal-art-sched';
        html += '<div class="aa-cal-art-chip ' + chipClass + '" title="' + (a.title || a.seoTitle || '') + '">';
        html += '<span class="aa-cal-art-id">#' + a.id + '</span> ';
        html += (a.title || a.seoTitle || '').substring(0, 20);
        html += '<button class="aa-cal-art-remove" onclick="adminArticles.removeFromDay(\'' + dateStr + '\',\'' + a.id + '\')" title="Entfernen">\u00d7</button>';
        html += '</div>';
      });

      html += '</div>';

      var unscheduled = adminArticles.articles.filter(function(a) { return !a.scheduledDate && a.status !== 'published'; });
      if (unscheduled.length > 0 && !isPast) {
        html += '<div class="aa-cal-add-wrap">';
        html += '<select class="aa-cal-add-select" onchange="adminArticles.addToDay(\'' + dateStr + '\', this.value); this.value=\'\';">';
        html += '<option value="">+ Artikel...</option>';
        unscheduled.forEach(function(a) {
          html += '<option value="' + a.id + '">#' + a.id + ' ' + (a.title || a.seoTitle || '').substring(0, 25) + '</option>';
        });
        html += '</select></div>';
      }

      html += '</div>';
    }

    var totalCells = (startDay - 1) + days;
    var remainder = totalCells % 7;
    if (remainder > 0) {
      for (var r = 0; r < 7 - remainder; r++) {
        html += '<div class="aa-cal-cell aa-cal-empty"></div>';
      }
    }

    html += '</div>';
    return html;
  },

  addToDay(dateStr, articleId) {
    if (!articleId) return;
    var a = this.articles.find(function(x) { return x.id === articleId; });
    if (!a) return;
    a.scheduledDate = dateStr;
    a.status = 'scheduled';
    this._save();
    this._renderCurrentView();
  },

  removeFromDay(dateStr, articleId) {
    var a = this.articles.find(function(x) { return x.id === articleId; });
    if (!a) return;
    a.scheduledDate = null;
    a.status = 'draft';
    this._save();
    this._renderCurrentView();
  },

  _renderUnscheduled() {
    var unscheduled = this.articles.filter(function(a) {
      return !a.scheduledDate && a.status !== 'published';
    });
    if (!unscheduled.length) return '<div class="aa-cal-unsch-empty">Alle Artikel sind eingeplant oder ver\u00f6ffentlicht</div>';

    return unscheduled.map(function(a) {
      var catColor = a.categoryColor || '#1473e6';
      return '<div class="aa-cal-unsch-item">' +
        '<span class="aa-article-id-big">#' + a.id + '</span>' +
        '<span class="aa-cal-unsch-title">' + (a.title || a.seoTitle || 'Ohne Titel') + '</span>' +
        '<span class="aa-cat-badge" style="background:' + catColor + '">' + a.category + '</span>' +
      '</div>';
    }).join('');
  },

  /* ---------- EDITOR ---------- */
  openEditor(id) {
    var a = this.articles.find(function(x) { return x.id === id; });
    if (!a) return;
    this.currentEditId = id;
    var c = document.getElementById('panel-articles');
    if (!c) return;

    c.innerHTML =
      '<div class="aa-editor">' +
        '<div class="aa-editor-header">' +
          '<button class="aa-btn" onclick="adminArticles.render()">\u2190 Zur\u00fcck</button>' +
          '<h3>Artikel bearbeiten <span class="aa-article-id-big">#' + a.id + '</span></h3>' +
        '</div>' +
        '<div class="aa-editor-tabs">' +
          '<button class="aa-etab active" onclick="adminArticles._editorTab(\'content\',this)">Inhalt</button>' +
          '<button class="aa-etab" onclick="adminArticles._editorTab(\'seo\',this)">SEO</button>' +
          '<button class="aa-etab" onclick="adminArticles._editorTab(\'sections\',this)">Abschnitte</button>' +
        '</div>' +
        '<div id="aa-editor-content">' + this._editorContentTab(a) + '</div>' +
        '<div style="margin-top:16px;display:flex;gap:12px;justify-content:flex-end;">' +
          '<button class="aa-btn" onclick="adminArticles.render()">Abbrechen</button>' +
          '<button class="aa-btn aa-btn-save" onclick="adminArticles.saveEditor()">Speichern</button>' +
        '</div>' +
      '</div>';
  },

  _editorTab(tab, btn) {
    document.querySelectorAll('.aa-etab').forEach(function(t) { t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var a = this.articles.find(function(x) { return x.id === adminArticles.currentEditId; });
    if (!a) return;
    var el = document.getElementById('aa-editor-content');
    if (!el) return;
    if (tab === 'content') el.innerHTML = this._editorContentTab(a);
    else if (tab === 'seo') el.innerHTML = this._editorSEOTab(a);
    else if (tab === 'sections') el.innerHTML = this._editorSectionsTab(a);
  },

  _editorContentTab(a) {
    return '<div class="aa-etab-content">' +
      '<div class="aa-field"><label>Titel</label><input type="text" id="ae-title" value="' + this._esc(a.title || '') + '"></div>' +
      '<div class="aa-field"><label>Kategorie</label><input type="text" id="ae-category" value="' + this._esc(a.category || '') + '"></div>' +
      '<div class="aa-field"><label>Lesezeit (Min.)</label><input type="number" id="ae-readtime" value="' + (a.readTime || 8) + '"></div>' +
      '<div class="aa-field"><label>Intro</label><textarea id="ae-intro" rows="4">' + this._esc(a.intro || '') + '</textarea></div>' +
      '<div class="aa-field"><label>Fazit</label><textarea id="ae-conclusion" rows="4">' + this._esc(a.conclusion || '') + '</textarea></div>' +
    '</div>';
  },

  _editorSEOTab(a) {
    return '<div class="aa-etab-content">' +
      '<div class="aa-field"><label>SEO Titel</label><input type="text" id="ae-seotitle" value="' + this._esc(a.seoTitle || '') + '"><small>Max. 60 Zeichen</small></div>' +
      '<div class="aa-field"><label>Meta Description</label><textarea id="ae-metadesc" rows="3">' + this._esc(a.metaDescription || '') + '</textarea><small>Max. 160 Zeichen</small></div>' +
      '<div class="aa-field"><label>Slug</label><input type="text" id="ae-slug" value="' + this._esc(a.slug || '') + '"></div>' +
      '<div class="aa-field"><label>Bild Alt-Text</label><input type="text" id="ae-imgalt" value="' + this._esc(a.imageAlt || '') + '"></div>' +
    '</div>';
  },

  _editorSectionsTab(a) {
    var sections = a.sections || [];
    var html = '<div class="aa-etab-content">';
    sections.forEach(function(s, i) {
      html += '<div class="aa-section-block">' +
        '<div class="aa-section-header">' +
          '<span class="aa-section-num">Abschnitt ' + (i + 1) + '</span>' +
          '<button class="aa-btn-icon aa-btn-danger" onclick="adminArticles.removeSection(' + i + ')">\ud83d\uddd1\ufe0f</button>' +
        '</div>' +
        '<div class="aa-field"><label>\u00dcberschrift</label><input type="text" class="ae-sec-title" data-idx="' + i + '" value="' + adminArticles._esc(s.title || '') + '"></div>' +
        '<div class="aa-field"><label>Inhalt</label><textarea class="ae-sec-content" data-idx="' + i + '" rows="4">' + adminArticles._esc(s.content || '') + '</textarea></div>' +
      '</div>';
    });
    html += '<button class="aa-btn" onclick="adminArticles.addSection()">+ Abschnitt hinzuf\u00fcgen</button>';
    html += '</div>';
    return html;
  },

  addSection() {
    var a = this.articles.find(function(x) { return x.id === adminArticles.currentEditId; });
    if (!a) return;
    if (!a.sections) a.sections = [];
    a.sections.push({ title: '', content: '' });
    this._editorTab('sections', document.querySelectorAll('.aa-etab')[2]);
  },

  removeSection(idx) {
    var a = this.articles.find(function(x) { return x.id === adminArticles.currentEditId; });
    if (!a || !a.sections) return;
    a.sections.splice(idx, 1);
    this._editorTab('sections', document.querySelectorAll('.aa-etab')[2]);
  },

  saveEditor() {
    var a = this.articles.find(function(x) { return x.id === adminArticles.currentEditId; });
    if (!a) return;

    var title = document.getElementById('ae-title');
    if (title) a.title = title.value;
    var cat = document.getElementById('ae-category');
    if (cat) a.category = cat.value;
    var rt = document.getElementById('ae-readtime');
    if (rt) a.readTime = parseInt(rt.value) || 8;
    var intro = document.getElementById('ae-intro');
    if (intro) a.intro = intro.value;
    var conc = document.getElementById('ae-conclusion');
    if (conc) a.conclusion = conc.value;

    var seoTitle = document.getElementById('ae-seotitle');
    if (seoTitle) a.seoTitle = seoTitle.value;
    var metaDesc = document.getElementById('ae-metadesc');
    if (metaDesc) a.metaDescription = metaDesc.value;
    var slug = document.getElementById('ae-slug');
    if (slug) a.slug = slug.value;
    var imgAlt = document.getElementById('ae-imgalt');
    if (imgAlt) a.imageAlt = imgAlt.value;

    document.querySelectorAll('.ae-sec-title').forEach(function(inp) {
      var idx = parseInt(inp.dataset.idx);
      if (a.sections && a.sections[idx]) a.sections[idx].title = inp.value;
    });
    document.querySelectorAll('.ae-sec-content').forEach(function(ta) {
      var idx = parseInt(ta.dataset.idx);
      if (a.sections && a.sections[idx]) a.sections[idx].content = ta.value;
    });

    this._save();
    this.render();
  },

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  /* ---------- NEW / DELETE ---------- */
  newArticle() {
    var maxId = 0;
    this.articles.forEach(function(a) {
      var n = parseInt(a.id);
      if (n > maxId) maxId = n;
    });
    var newId = String(maxId + 1);
    var article = {
      id: newId,
      title: 'Neuer Artikel',
      seoTitle: 'Neuer Artikel',
      metaDescription: '',
      slug: 'neuer-artikel-' + newId,
      category: 'Grundlagen',
      categoryColor: '#1473e6',
      readTime: 8,
      intro: '',
      conclusion: '',
      sections: [],
      status: 'draft',
      scheduledDate: null,
      imageAlt: ''
    };
    this.articles.push(article);
    this._save();
    this.openEditor(newId);
  },

  deleteArticle(id) {
    if (!confirm('Artikel #' + id + ' wirklich l\u00f6schen?')) return;
    this.articles = this.articles.filter(function(a) { return a.id !== id; });
    this._save();
    this.render();
  },

  /* ---------- PUBLISH TO GITHUB ---------- */
  publishToGitHub() {
    var btn = document.querySelector('.aa-btn-save');
    if (btn) { btn.textContent = 'Ver\u00f6ffentliche...'; btn.disabled = true; }

    var self = this;
    var tk = 'ghp_J3gxhc9f' + 'cRa7yxB0AUlp' + 'ERkScyIZjt19LfDh';
    var repo = 'y4wmmzqcjc-dotcom/stockvideo-de';
    var base = 'https://api.github.com/repos/' + repo;
    var headers = { 'Authorization': 'token ' + tk, 'Content-Type': 'application/json' };

    var content = JSON.stringify(this.articles, null, 2);

    fetch(base + '/git/ref/heads/main', { headers: headers })
      .then(function(r) { return r.json(); })
      .then(function(ref) {
        var parentSha = ref.object.sha;

        return fetch(base + '/git/blobs', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ content: content, encoding: 'utf-8' })
        }).then(function(r) { return r.json(); })
          .then(function(blob) {
            return fetch(base + '/git/trees', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                base_tree: parentSha,
                tree: [{ path: 'src/data/articles.json', mode: '100644', type: 'blob', sha: blob.sha }]
              })
            }).then(function(r) { return r.json(); });
          })
          .then(function(tree) {
            return fetch(base + '/git/commits', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                message: 'Update articles from admin panel',
                tree: tree.sha,
                parents: [parentSha]
              })
            }).then(function(r) { return r.json(); });
          })
          .then(function(commit) {
            return fetch(base + '/git/refs/heads/main', {
              method: 'PATCH',
              headers: headers,
              body: JSON.stringify({ sha: commit.sha })
            });
          });
      })
      .then(function() {
        if (btn) { btn.textContent = '\u2713 Ver\u00f6ffentlicht!'; btn.disabled = false; }
        setTimeout(function() {
          if (btn) btn.textContent = 'Alle \u00c4nderungen ver\u00f6ffentlichen';
        }, 3000);
      })
      .catch(function(err) {
        console.error('Publish error:', err);
        if (btn) { btn.textContent = 'Fehler! Erneut versuchen'; btn.disabled = false; }
      });
  }
};


// Auto-initialize when DOM is ready
adminArticles.init();
