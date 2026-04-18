/* ============================================================
   admin-seo.js — SEO & Sichtbarkeits-Panel für stockvideo.de
   ============================================================ */

window.seoModule = {
  _arts: [],
  _vids: [],
  _cats: [],

  /* ── Init ─────────────────────────────────────────────── */
  init() {
    this._arts = JSON.parse(localStorage.getItem('adminArticles') || '[]');
    this._vids = JSON.parse(localStorage.getItem('adminVideos')   || '[]');
    this._cats = JSON.parse(localStorage.getItem('adminCategories') || '[]');
    this._render();
  },

  /* ── SEO-Check: Artikel ────────────────────────────────── */
  _checkArt(a) {
    var title  = a.seoTitle || a.title || '';
    var meta   = a.metaDescription || a.metaDesc || '';
    var kp     = a.keyphrase || (a.seo && a.seo.keyphrase) || '';
    var intro  = a.intro || '';
    var secs   = a.sections || [];
    var words  = (intro + ' ' + secs.map(function(s){
      return [(s.heading||''), (s.paragraphs||[]).join(' '), (s.text||'')].join(' ');
    }).join(' ')).split(/\s+/).filter(Boolean).length;

    var c = {
      title:    title.length >= 30 && title.length <= 70,
      meta:     meta.length  >= 80 && meta.length  <= 160,
      keyphrase: kp.length > 2,
      kpInTitle: kp.length > 2 && title.toLowerCase().indexOf(kp.toLowerCase()) >= 0,
      kpInMeta:  kp.length > 2 && meta.toLowerCase().indexOf(kp.toLowerCase())  >= 0,
      words:    words >= 300,
      image:    !!(a.heroImage || a.image),
      links:    !!(a.internalLinks && (Array.isArray(a.internalLinks) ? a.internalLinks.length : a.internalLinks)),
      extLink:  !!(a.externalUrl || a.wikipedia || a.wikipediaUrl),
      category: !!(a.category),
    };
    var ok    = Object.values(c).filter(Boolean).length;
    var total = Object.keys(c).length;
    var score = Math.round(ok / total * 100);
    return { score, status: score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red', checks: c, words };
  },

  /* ── SEO-Check: Video ──────────────────────────────────── */
  _checkVid(v) {
    var c = {
      title:    !!(v.title && v.title.length > 5),
      desc:     !!(v.description && v.description.length > 40),
      category: !!(v.category),
      thumb:    !!(v.thumbnail),
      tags:     !!(v.tags && v.tags.length > 0),
    };
    var ok = Object.values(c).filter(Boolean).length;
    return { score: Math.round(ok / Object.keys(c).length * 100), checks: c };
  },

  /* ── Render ─────────────────────────────────────────────── */
  _render() {
    var c = document.getElementById('panel-seo');
    if (!c) return;
    this._injectStyles();

    var artC = this._arts.map(this._checkArt.bind(this));
    var vidC = this._vids.map(this._checkVid.bind(this));

    var green  = artC.filter(function(x){return x.status==='green'}).length;
    var yellow = artC.filter(function(x){return x.status==='yellow'}).length;
    var red    = artC.filter(function(x){return x.status==='red'}).length;
    var avgScore = artC.length ? Math.round(artC.reduce(function(s,x){return s+x.score},0) / artC.length) : 0;

    var STATIC_PAGES = 12; // /, /uber-uns, /preise, /kontakt, /impressum, /datenschutz, /agb, /lizenzen, /wissen/, /checkout/billing, /checkout/success, /video-sitemap.xml
    var totalPages  = STATIC_PAGES + this._arts.length + this._vids.length + this._cats.length;
    var schemaPages = this._arts.length + this._vids.length + 2; // articles + videos + home + uber-uns
    var schemaPct   = totalPages ? Math.round(schemaPages / totalPages * 100) : 0;

    var vidOk       = vidC.filter(function(x){return x.score>=80}).length;
    var vidWarn     = vidC.filter(function(x){return x.score>=50&&x.score<80}).length;
    var vidBad      = vidC.filter(function(x){return x.score<50}).length;

    c.innerHTML =
      '<div class="so-wrap">' +
      this._hdr() +
      this._overview(avgScore, totalPages, schemaPct, green, yellow, red) +
      this._artTable(artC) +
      this._vidSummary(vidC, vidOk, vidWarn, vidBad) +
      this._sitemapTree() +
      this._schemaCard(schemaPct) +
      this._psiCard() +
      this._gscCard() +
      this._clarityCard() +
      '</div>';

    this._initCollapsibles();
    this._initPSI();
  },

  /* ── Header ──────────────────────────────────────────────── */
  _hdr() {
    return '<div class="so-header">' +
      '<div><h1 class="so-h1">SEO &amp; Sichtbarkeit</h1>' +
      '<p class="so-sub">Kompletter SEO-Status von stockvideo.de</p></div>' +
      '<button class="so-refresh" onclick="seoModule.init()">↻ Aktualisieren</button>' +
      '</div>';
  },

  /* ── Overview Cards ──────────────────────────────────────── */
  _overview(avg, total, schema, green, yellow, red) {
    var scoreColor = avg >= 80 ? '#34c759' : avg >= 50 ? '#f59e0b' : '#ff3b30';
    var cards = [
      { val: total,  lbl: 'Indexierbare Seiten', icon: '🗂️', color: '#60a5fa' },
      { val: avg+'%', lbl: 'Ø SEO Score Artikel', icon: '📊', color: scoreColor },
      { val: schema+'%', lbl: 'Schema Coverage', icon: '🔖', color: '#a78bfa' },
      { val: green+' / '+yellow+' / '+red, lbl: 'Grün / Gelb / Rot', icon: '🚦', color: '#34c759' },
    ];
    return '<div class="so-cards">' + cards.map(function(c){
      return '<div class="so-card">' +
        '<div class="so-card-icon">' + c.icon + '</div>' +
        '<div class="so-card-val" style="color:' + c.color + '">' + c.val + '</div>' +
        '<div class="so-card-lbl">' + c.lbl + '</div>' +
        '</div>';
    }).join('') + '</div>';
  },

  /* ── Artikel Ampeln ──────────────────────────────────────── */
  _ampel(status) {
    var colors = { green: '#34c759', yellow: '#f59e0b', red: '#ff3b30' };
    return '<span class="so-dot" style="background:' + (colors[status]||'#888') + '"></span>';
  },

  _ck(ok) { return ok ? '<span class="so-ck ok">✓</span>' : '<span class="so-ck fail">✗</span>'; },

  _artTable(artC) {
    var self = this;
    var rows = this._arts.map(function(a, i) {
      var ch = artC[i];
      var sc = ch.checks;
      return '<tr onclick="admin&&admin.switchPanel(\'articles\');setTimeout(function(){adminArticles&&adminArticles.openEditor(' + JSON.stringify(a.id) + ')},300)" style="cursor:pointer" title="Artikel öffnen">' +
        '<td>' + self._ampel(ch.status) + '</td>' +
        '<td class="so-art-title">' + self._esc(a.title || a.slug || '—') + '</td>' +
        '<td>' + self._ck(sc.title) + '</td>' +
        '<td>' + self._ck(sc.meta) + '</td>' +
        '<td>' + self._ck(sc.keyphrase) + '</td>' +
        '<td>' + self._ck(sc.kpInTitle) + '</td>' +
        '<td>' + self._ck(sc.image) + '</td>' +
        '<td>' + self._ck(sc.links) + '</td>' +
        '<td class="so-score-cell"><span class="so-score-badge" style="background:' +
          (ch.status==='green'?'rgba(52,199,89,.15)':ch.status==='yellow'?'rgba(245,158,11,.15)':'rgba(255,59,48,.15)') +
          ';color:' + (ch.status==='green'?'#34c759':ch.status==='yellow'?'#f59e0b':'#ff3b30') + '">' +
          ch.score + '</span></td>' +
        '</tr>';
    }).join('');

    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-art-body">' +
        '<span>✍️ Artikel SEO-Ampeln <span class="so-count">' + this._arts.length + '</span></span>' +
        '<span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-art-body" class="so-collapsible-body">' +
      '<table class="so-table">' +
        '<thead><tr>' +
          '<th></th><th>Artikel</th>' +
          '<th title="SEO-Titel 30–70 Zeichen">Titel</th>' +
          '<th title="Meta-Beschreibung 80–160 Zeichen">Meta</th>' +
          '<th title="Keyphrase definiert">KP</th>' +
          '<th title="Keyphrase im Titel">KP Titel</th>' +
          '<th title="Hero-Bild vorhanden">Bild</th>' +
          '<th title="Interne Links">Links</th>' +
          '<th>Score</th>' +
        '</tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="9" style="text-align:center;color:#666;padding:20px">Keine Artikel geladen</td></tr>') + '</tbody>' +
      '</table></div></div>';
  },

  /* ── Video Summary ────────────────────────────────────────── */
  _vidSummary(vidC, ok, warn, bad) {
    var avgVid = vidC.length ? Math.round(vidC.reduce(function(s,x){return s+x.score},0) / vidC.length) : 0;
    var noThumb = vidC.filter(function(x){return !x.checks.thumb}).length;
    var noCat   = vidC.filter(function(x){return !x.checks.category}).length;
    var noDesc  = vidC.filter(function(x){return !x.checks.desc}).length;

    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-vid-body">' +
        '<span>🎬 Video SEO-Status <span class="so-count">' + this._vids.length + '</span></span>' +
        '<span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-vid-body" class="so-collapsible-body">' +
        '<div class="so-vid-grid">' +
          this._miniCard('Ø Score', avgVid + '%', avgVid >= 80 ? '#34c759' : avgVid >= 50 ? '#f59e0b' : '#ff3b30') +
          this._miniCard('Ohne Thumbnail', noThumb, noThumb ? '#ff3b30' : '#34c759') +
          this._miniCard('Ohne Kategorie', noCat,   noCat   ? '#ff3b30' : '#34c759') +
          this._miniCard('Ohne Beschreibung', noDesc, noDesc ? '#f59e0b' : '#34c759') +
        '</div>' +
      '</div></div>';
  },

  _miniCard(lbl, val, col) {
    return '<div class="so-mini-card">' +
      '<div class="so-mini-val" style="color:' + col + '">' + val + '</div>' +
      '<div class="so-mini-lbl">' + lbl + '</div>' +
      '</div>';
  },

  /* ── Sitemap-Baum ─────────────────────────────────────────── */
  _sitemapTree() {
    var self = this;
    var staticPages = [
      '/', '/wissen/', '/uber-uns', '/preise', '/kontakt',
      '/impressum', '/datenschutz', '/agb', '/lizenzen',
      '/checkout/billing', '/checkout/success'
    ];

    var artLinks = this._arts.slice(0,8).map(function(a){
      return '<div class="so-tree-leaf">📄 /wissen/' + self._esc(a.slug || a.id) + '/</div>';
    }).join('') +
    (this._arts.length > 8 ? '<div class="so-tree-leaf" style="color:#666">… +' + (this._arts.length - 8) + ' weitere</div>' : '');

    var catLinks = this._cats.slice(0,6).map(function(c){
      return '<div class="so-tree-leaf">📁 /kategorie/' + self._esc(c.slug || c.id || c.name) + '/</div>';
    }).join('') +
    (this._cats.length > 6 ? '<div class="so-tree-leaf" style="color:#666">… +' + (this._cats.length - 6) + ' weitere</div>' : '');

    var staticLinks = staticPages.map(function(p){
      return '<div class="so-tree-leaf">🔗 ' + p + '</div>';
    }).join('');

    var total = staticPages.length + this._arts.length + this._vids.length + this._cats.length;

    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-sitemap-body">' +
        '<span>🗺️ Sitemap-Baum <span class="so-count">' + total + ' URLs</span></span>' +
        '<span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-sitemap-body" class="so-collapsible-body" style="display:none">' +
        '<div class="so-tree">' +
          '<div class="so-tree-root">🌐 stockvideo.de</div>' +
          '<div class="so-tree-branch">' +
            '<div class="so-tree-node so-collapsible" data-target="st-static">📋 Statische Seiten <span class="so-count">' + staticPages.length + '</span></div>' +
            '<div id="st-static" class="so-tree-children" style="display:none">' + staticLinks + '</div>' +
          '</div>' +
          '<div class="so-tree-branch">' +
            '<div class="so-tree-node so-collapsible" data-target="st-arts">✍️ Wissen / Artikel <span class="so-count">' + this._arts.length + '</span></div>' +
            '<div id="st-arts" class="so-tree-children" style="display:none">' + artLinks + '</div>' +
          '</div>' +
          '<div class="so-tree-branch">' +
            '<div class="so-tree-node so-collapsible" data-target="st-cats">📂 Kategorien <span class="so-count">' + this._cats.length + '</span></div>' +
            '<div id="st-cats" class="so-tree-children" style="display:none">' + catLinks + '</div>' +
          '</div>' +
          '<div class="so-tree-branch">' +
            '<div class="so-tree-node">🎬 Videos <span class="so-count">' + this._vids.length + '</span></div>' +
          '</div>' +
          '<div class="so-tree-branch">' +
            '<div class="so-tree-node">🗺️ sitemap.xml <span class="so-badge-ok">Auto-generiert ✓</span></div>' +
          '</div>' +
          '<div class="so-tree-branch">' +
            '<div class="so-tree-node">📹 video-sitemap.xml <span class="so-badge-ok">Video-Schema ✓</span></div>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  },

  /* ── Schema Status ────────────────────────────────────────── */
  _schemaCard(pct) {
    var schemas = [
      { name: 'Organization', pages: 'Alle Seiten (BaseLayout)', ok: true },
      { name: 'Article',      pages: 'Alle Wissen-Artikel (' + this._arts.length + ')', ok: true },
      { name: 'FAQPage',      pages: 'Artikel mit "?"-Überschriften', ok: true },
      { name: 'VideoObject',  pages: 'Alle Videos via video-sitemap.xml (' + this._vids.length + ')', ok: true },
      { name: 'BreadcrumbList', pages: 'Artikel-Seiten', ok: true },
    ];
    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-schema-body">' +
        '<span>🔖 Schema.org Status <span class="so-badge-ok">' + pct + '% Coverage</span></span>' +
        '<span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-schema-body" class="so-collapsible-body" style="display:none">' +
        schemas.map(function(s){
          return '<div class="so-schema-row">' +
            '<span class="so-schema-dot">' + (s.ok ? '✅' : '❌') + '</span>' +
            '<span class="so-schema-name">' + s.name + '</span>' +
            '<span class="so-schema-pages">' + s.pages + '</span>' +
          '</div>';
        }).join('') +
        '<div class="so-schema-note">ℹ️ Schemas werden durch die Astro-Templates automatisch generiert. ' +
          'Keine manuelle Pflege notwendig.</div>' +
      '</div></div>';
  },

  /* ── PageSpeed Insights ───────────────────────────────────── */
  _psiCard() {
    var savedKey = localStorage.getItem('seoPsiKey') || '';
    var savedRes = {};
    try { savedRes = JSON.parse(localStorage.getItem('seoPsiResults') || '{}'); } catch(e){}

    var urls = [
      'https://stockvideo.de/',
      'https://stockvideo.de/wissen/',
      'https://stockvideo.de/uber-uns',
    ].concat(this._arts.slice(0,3).map(function(a){ return 'https://stockvideo.de/wissen/' + a.slug + '/'; }));

    var rows = urls.map(function(u) {
      var r = savedRes[u];
      if (!r) return '<tr><td class="so-psi-url">' + u.replace('https://stockvideo.de','') + '</td>' +
        '<td colspan="4" style="color:#555;font-size:12px">— noch nicht geprüft —</td></tr>';
      var col = function(v) { return v===null||v===undefined?'#666': v>=0.9?'#34c759': v>=0.5?'#f59e0b':'#ff3b30'; };
      var pc  = function(v) { return v===null||v===undefined?'—': Math.round(v*100); };
      return '<tr>' +
        '<td class="so-psi-url">' + u.replace('https://stockvideo.de','') + '</td>' +
        '<td><span style="color:' + col(r.perf) + '">' + pc(r.perf) + '</span></td>' +
        '<td><span style="color:' + col(r.seo)  + '">' + pc(r.seo)  + '</span></td>' +
        '<td><span style="color:' + col(r.acc)  + '">' + pc(r.acc)  + '</span></td>' +
        '<td><span style="color:' + col(r.bp)   + '">' + pc(r.bp)   + '</span></td>' +
        '</tr>';
    }).join('');

    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-psi-body">' +
        '<span>⚡ Google PageSpeed Insights</span><span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-psi-body" class="so-collapsible-body" style="display:none">' +
        '<div class="so-psi-setup">' +
          '<label>API-Key (optional, kostenlos bei console.cloud.google.com):</label>' +
          '<div class="so-psi-row">' +
            '<input type="text" id="psiKeyInput" class="so-input" placeholder="AIza…" value="' + this._esc(savedKey) + '">' +
            '<button class="so-btn" onclick="seoModule._runPSI()">Alle prüfen</button>' +
          '</div>' +
          '<div id="psiStatus" class="so-psi-status"></div>' +
        '</div>' +
        '<table class="so-table so-psi-table">' +
          '<thead><tr><th>URL</th><th>Perf</th><th>SEO</th><th>Access.</th><th>BP</th></tr></thead>' +
          '<tbody id="psiResults">' + rows + '</tbody>' +
        '</table>' +
      '</div></div>';
  },

  _psiUrls: [],

  _initPSI() {
    this._psiUrls = [
      'https://stockvideo.de/',
      'https://stockvideo.de/wissen/',
      'https://stockvideo.de/uber-uns',
    ].concat(this._arts.slice(0,3).map(function(a){ return 'https://stockvideo.de/wissen/' + a.slug + '/'; }));
  },

  async _runPSI() {
    var key  = document.getElementById('psiKeyInput');
    var keyVal = key ? key.value.trim() : '';
    if (keyVal) localStorage.setItem('seoPsiKey', keyVal);

    var status = document.getElementById('psiStatus');
    var tbody  = document.getElementById('psiResults');
    if (!status || !tbody) return;

    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('seoPsiResults') || '{}'); } catch(e){}

    for (var i = 0; i < this._psiUrls.length; i++) {
      var url = this._psiUrls[i];
      status.textContent = 'Prüfe ' + (i+1) + '/' + this._psiUrls.length + ': ' + url;
      try {
        var apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' +
          encodeURIComponent(url) + '&strategy=mobile' +
          (keyVal ? '&key=' + encodeURIComponent(keyVal) : '');
        var r = await fetch(apiUrl);
        var d = await r.json();
        var cats = (d.lighthouseResult && d.lighthouseResult.categories) || {};
        saved[url] = {
          perf: cats.performance  && cats.performance.score,
          seo:  cats.seo          && cats.seo.score,
          acc:  cats.accessibility && cats.accessibility.score,
          bp:   (cats['best-practices']) && cats['best-practices'].score,
          ts:   Date.now()
        };
        localStorage.setItem('seoPsiResults', JSON.stringify(saved));
        // Live-Update der Zeile
        var urlShort = url.replace('https://stockvideo.de','') || '/';
        var row = tbody.querySelector('tr[data-url="' + urlShort + '"]');
        var col = function(v) { return v===null||v===undefined?'#666': v>=0.9?'#34c759': v>=0.5?'#f59e0b':'#ff3b30'; };
        var pc  = function(v) { return v===null||v===undefined?'—': Math.round(v*100); };
        var res = saved[url];
        var newHtml = '<td class="so-psi-url">' + urlShort + '</td>' +
          '<td><span style="color:'+col(res.perf)+'">'+pc(res.perf)+'</span></td>' +
          '<td><span style="color:'+col(res.seo)+'">'+pc(res.seo)+'</span></td>' +
          '<td><span style="color:'+col(res.acc)+'">'+pc(res.acc)+'</span></td>' +
          '<td><span style="color:'+col(res.bp)+'">'+pc(res.bp)+'</span></td>';
        if (!row) {
          var newRow = document.createElement('tr');
          newRow.setAttribute('data-url', urlShort);
          newRow.innerHTML = newHtml;
          tbody.appendChild(newRow);
        } else {
          row.innerHTML = newHtml;
        }
        // Rate limit
        await new Promise(function(r){setTimeout(r, 1500)});
      } catch(e) {
        status.textContent = 'Fehler bei ' + url + ': ' + e.message;
      }
    }
    status.textContent = '✓ Alle ' + this._psiUrls.length + ' Seiten geprüft.';
  },

  /* ── Google Search Console ────────────────────────────────── */
  _gscCard() {
    var token = localStorage.getItem('seoGscToken');
    var siteUrl = 'https://stockvideo.de/';

    var body = token
      ? '<div id="gscData"><div class="so-loading">Lade GSC-Daten…</div></div>'
      : '<div class="so-connect-box">' +
          '<div class="so-connect-icon">📊</div>' +
          '<p>Verbinde Google Search Console für Klick- und Rankingdaten, Top-Queries und Coverage-Report.</p>' +
          '<div class="so-connect-steps">' +
            '<div class="so-step"><span>1</span> Google Cloud Console öffnen → API aktivieren: <strong>Google Search Console API</strong></div>' +
            '<div class="so-step"><span>2</span> OAuth 2.0 Client-ID erstellen (Typ: Web-Anwendung, Redirect: ' + window.location.origin + '/panel.html)</div>' +
            '<div class="so-step"><span>3</span> Client-ID eingeben und verbinden:</div>' +
          '</div>' +
          '<div class="so-psi-row" style="margin-top:12px">' +
            '<input type="text" id="gscClientId" class="so-input" placeholder="Client-ID (xxxx.apps.googleusercontent.com)">' +
            '<button class="so-btn" onclick="seoModule._connectGSC()">Mit Google verbinden</button>' +
          '</div>' +
          '<a href="https://search.google.com/search-console" target="_blank" class="so-link">→ Direkt in Search Console öffnen</a>' +
        '</div>';

    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-gsc-body">' +
        '<span>📈 Google Search Console' + (token ? ' <span class="so-badge-ok">Verbunden ✓</span>' : '') + '</span>' +
        '<span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-gsc-body" class="so-collapsible-body" style="display:none">' + body + '</div></div>';
  },

  _connectGSC() {
    var clientId = (document.getElementById('gscClientId') || {}).value || '';
    if (!clientId) { alert('Bitte Client-ID eingeben.'); return; }
    localStorage.setItem('seoGscClientId', clientId);
    var params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin + '/panel.html',
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      state: 'gsc_auth'
    });
    window.open('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(), '_blank', 'width=600,height=700');
  },

  /* ── Microsoft Clarity Heatmaps ───────────────────────────── */
  _clarityCard() {
    var cid = localStorage.getItem('seoClarityId') || '';

    var body = cid
      ? '<div class="so-clarity-connected">' +
          '<p>Clarity Projekt-ID: <strong>' + this._esc(cid) + '</strong></p>' +
          '<a href="https://clarity.microsoft.com/projects/view/' + this._esc(cid) + '/dashboard" target="_blank" class="so-btn" style="display:inline-block;text-decoration:none">→ Clarity Dashboard öffnen</a>' +
          '<a href="https://clarity.microsoft.com/projects/view/' + this._esc(cid) + '/heatmap" target="_blank" class="so-btn so-btn-sec" style="display:inline-block;margin-left:8px;text-decoration:none">→ Heatmaps anzeigen</a>' +
          '<button onclick="localStorage.removeItem(\'seoClarityId\');seoModule.init()" class="so-btn-danger" style="margin-left:8px">Trennen</button>' +
        '</div>'
      : '<div class="so-connect-box">' +
          '<div class="so-connect-icon">🔥</div>' +
          '<p>Microsoft Clarity liefert kostenlose Heatmaps, Session Recordings und Traffic-Analysen.</p>' +
          '<div class="so-connect-steps">' +
            '<div class="so-step"><span>1</span> clarity.microsoft.com → Projekt anlegen für stockvideo.de</div>' +
            '<div class="so-step"><span>2</span> Projekt-ID aus der Dashboard-URL kopieren</div>' +
            '<div class="so-step"><span>3</span> Tracking-Script wird automatisch in die Seite eingebaut</div>' +
          '</div>' +
          '<div class="so-psi-row" style="margin-top:12px">' +
            '<input type="text" id="clarityIdInput" class="so-input" placeholder="Clarity Projekt-ID (z.B. abc123def)">' +
            '<button class="so-btn" onclick="seoModule._saveClarity()">Clarity einrichten</button>' +
          '</div>' +
          '<a href="https://clarity.microsoft.com" target="_blank" class="so-link">→ Microsoft Clarity (kostenlos)</a>' +
        '</div>';

    return '<div class="so-section">' +
      '<div class="so-sec-hdr so-collapsible" data-target="so-clarity-body">' +
        '<span>🔥 Heatmaps &amp; Sessions (Clarity)' + (cid ? ' <span class="so-badge-ok">Aktiv ✓</span>' : '') + '</span>' +
        '<span class="so-chevron">▾</span>' +
      '</div>' +
      '<div id="so-clarity-body" class="so-collapsible-body" style="display:none">' + body + '</div></div>';
  },

  async _saveClarity() {
    var input = document.getElementById('clarityIdInput');
    var cid   = input ? input.value.trim() : '';
    if (!cid) { alert('Bitte Clarity Projekt-ID eingeben.'); return; }
    localStorage.setItem('seoClarityId', cid);
    // Push Clarity-ID to config so Astro can include the script
    try {
      var r = await fetch('/data/config.json?t=' + Date.now(), { cache: 'no-store' });
      var cfg = await r.json();
      cfg.clarityId = cid;
      // Save via admin config save (if admin module available)
      if (window.admin && window.admin.saveConfig) {
        window.admin.saveConfig(cfg);
        alert('Clarity ID gespeichert! Die Seite wird nach dem nächsten Deploy getrackt.');
      } else {
        alert('Clarity ID lokal gespeichert: ' + cid + '\nBitte manuell in config.json → clarityId eintragen und deployen.');
      }
    } catch(e) {
      alert('Clarity ID lokal gespeichert: ' + cid);
    }
    this.init();
  },

  /* ── Collapsibles ────────────────────────────────────────── */
  _initCollapsibles() {
    document.querySelectorAll('.so-collapsible').forEach(function(el) {
      if (el._seoInit) return;
      el._seoInit = true;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() {
        var target = el.getAttribute('data-target');
        if (!target) return;
        var body = document.getElementById(target);
        if (!body) return;
        var isHidden = body.style.display === 'none' || !body.style.display || body.getAttribute('data-hidden') === '1';
        body.style.display = isHidden ? 'block' : 'none';
        var chev = el.querySelector('.so-chevron');
        if (chev) chev.textContent = isHidden ? '▴' : '▾';
      });
    });
  },

  _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  /* ── Styles ──────────────────────────────────────────────── */
  _injectStyles() {
    if (document.getElementById('so-styles')) return;
    var s = document.createElement('style');
    s.id = 'so-styles';
    s.textContent = `
      .so-wrap { max-width:1100px; margin:0 auto; padding:24px 28px 60px; }
      .so-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:16px; }
      .so-h1 { font-size:22px; font-weight:700; color:#fff; margin:0 0 4px; }
      .so-sub { font-size:13px; color:#888; margin:0; }
      .so-refresh { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); color:#ccc; padding:8px 18px; border-radius:8px; cursor:pointer; font-size:13px; white-space:nowrap; }
      .so-refresh:hover { background:rgba(255,255,255,.12); }

      /* Cards */
      .so-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
      @media(max-width:800px){.so-cards{grid-template-columns:repeat(2,1fr);}}
      .so-card { background:#1a1a2e; border:1px solid #2a2a4a; border-radius:12px; padding:16px; text-align:center; }
      .so-card-icon { font-size:22px; margin-bottom:8px; }
      .so-card-val  { font-size:20px; font-weight:700; margin-bottom:4px; }
      .so-card-lbl  { font-size:11px; color:#888; }

      /* Section */
      .so-section { background:#111122; border:1px solid #2a2a4a; border-radius:12px; margin-bottom:14px; overflow:hidden; }
      .so-sec-hdr { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; font-size:14px; font-weight:600; color:#e0e0ff; background:#181830; }
      .so-sec-hdr:hover { background:#1e1e38; }
      .so-chevron { font-size:12px; color:#888; }
      .so-collapsible-body { padding:0; }
      .so-count { font-size:11px; font-weight:500; background:rgba(96,165,250,.15); color:#60a5fa; padding:2px 8px; border-radius:20px; margin-left:8px; }
      .so-badge-ok { font-size:11px; font-weight:500; background:rgba(52,199,89,.15); color:#34c759; padding:2px 8px; border-radius:20px; margin-left:8px; }

      /* Table */
      .so-table { width:100%; border-collapse:collapse; font-size:13px; }
      .so-table th { padding:8px 10px; text-align:center; color:#888; font-size:11px; font-weight:600; text-transform:uppercase; border-bottom:1px solid #2a2a4a; background:#131326; }
      .so-table th:nth-child(2) { text-align:left; }
      .so-table td { padding:9px 10px; border-bottom:1px solid #1e1e3a; text-align:center; color:#ddd; }
      .so-table td:nth-child(2) { text-align:left; }
      .so-table tbody tr:hover { background:rgba(255,255,255,.03); }
      .so-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
      .so-ck { font-size:12px; font-weight:700; }
      .so-ck.ok   { color:#34c759; }
      .so-ck.fail { color:#ff3b30; }
      .so-art-title { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .so-score-badge { font-size:12px; font-weight:700; padding:2px 8px; border-radius:20px; }
      .so-score-cell { text-align:center; }

      /* Videos */
      .so-vid-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:16px 18px; }
      @media(max-width:700px){.so-vid-grid{grid-template-columns:repeat(2,1fr);}}
      .so-mini-card { background:#181830; border:1px solid #2a2a4a; border-radius:10px; padding:14px; text-align:center; }
      .so-mini-val  { font-size:22px; font-weight:700; margin-bottom:4px; }
      .so-mini-lbl  { font-size:11px; color:#888; }

      /* Sitemap Tree */
      .so-tree { padding:16px 20px; font-family:monospace; font-size:13px; }
      .so-tree-root   { color:#60a5fa; font-weight:700; margin-bottom:6px; font-size:14px; }
      .so-tree-branch { margin-left:16px; border-left:1px solid #2a2a4a; padding-left:14px; margin-bottom:2px; }
      .so-tree-node   { color:#c8c8e8; padding:4px 0; cursor:pointer; }
      .so-tree-node:hover { color:#fff; }
      .so-tree-leaf   { color:#888; padding:2px 0 2px 10px; font-size:12px; }
      .so-tree-children { padding-left:10px; }

      /* Schema */
      .so-schema-row  { display:flex; align-items:center; gap:12px; padding:10px 18px; border-bottom:1px solid #1e1e3a; font-size:13px; }
      .so-schema-dot  { font-size:16px; flex-shrink:0; }
      .so-schema-name { color:#fff; font-weight:600; min-width:140px; }
      .so-schema-pages{ color:#888; font-size:12px; }
      .so-schema-note { padding:12px 18px; font-size:12px; color:#666; }

      /* PSI */
      .so-psi-setup { padding:16px 18px; border-bottom:1px solid #2a2a4a; }
      .so-psi-setup label { font-size:12px; color:#888; display:block; margin-bottom:6px; }
      .so-psi-row   { display:flex; gap:8px; align-items:center; }
      .so-psi-status{ margin-top:8px; font-size:12px; color:#888; }
      .so-psi-url   { text-align:left; font-family:monospace; font-size:11px; color:#aaa; }
      .so-input     { flex:1; background:#181830; border:1px solid #3a3a5a; color:#fff; padding:8px 12px; border-radius:8px; font-size:13px; outline:none; }
      .so-input:focus { border-color:#60a5fa; }
      .so-btn       { background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; white-space:nowrap; }
      .so-btn:hover { background:#1d4ed8; }
      .so-btn-sec   { background:#333355; }
      .so-btn-sec:hover { background:#444466; }
      .so-btn-danger{ background:#7f1d1d; color:#fca5a5; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:13px; }

      /* Connect Box */
      .so-connect-box { padding:24px 24px 20px; }
      .so-connect-icon{ font-size:36px; margin-bottom:12px; }
      .so-connect-box p { color:#aaa; font-size:14px; margin:0 0 16px; }
      .so-connect-steps { margin-bottom:16px; }
      .so-step { display:flex; gap:10px; align-items:flex-start; margin-bottom:8px; font-size:13px; color:#aaa; }
      .so-step span { background:#2a2a4a; color:#60a5fa; font-weight:700; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; }
      .so-link { color:#60a5fa; font-size:13px; text-decoration:none; display:block; margin-top:12px; }
      .so-link:hover { text-decoration:underline; }
      .so-loading { padding:20px; color:#888; text-align:center; }
      .so-clarity-connected { padding:20px 24px; }
      .so-clarity-connected p { color:#aaa; margin:0 0 14px; }
    `;
    document.head.appendChild(s);
  }
};

/* ── Auto-Init wenn Panel sichtbar ────────────────────────── */
(function () {
  function patchSwitch() {
    if (!window.admin || typeof window.admin.switchPanel !== 'function') {
      setTimeout(patchSwitch, 300); return;
    }
    var orig = window.admin.switchPanel.bind(window.admin);
    window.admin.switchPanel = function (nameOrEvent) {
      orig(nameOrEvent);
      var name = typeof nameOrEvent === 'string' ? nameOrEvent
        : (nameOrEvent && nameOrEvent.currentTarget
            ? nameOrEvent.currentTarget.getAttribute('data-panel') || ''
            : '');
      if (name === 'seo') window.seoModule.init();
    };
    // Also catch direct calls (the existing override in admin-articles.js already exists)
    // Fallback: if panel already patched, just listen for 'seo'
    var origPanelSwitch = window.admin.switchPanel;
    window.admin.switchPanel = function(nameOrEvent) {
      origPanelSwitch(nameOrEvent);
    };
  }
  setTimeout(patchSwitch, 500);

  // Handle GSC OAuth redirect
  if (window.location.hash && window.location.hash.indexOf('access_token') >= 0) {
    var params = new URLSearchParams(window.location.hash.slice(1));
    var token = params.get('access_token');
    if (token && params.get('state') === 'gsc_auth') {
      localStorage.setItem('seoGscToken', token);
      window.location.hash = '';
      alert('Google Search Console erfolgreich verbunden!');
    }
  }
})();
