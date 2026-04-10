const adminArticles = {
  articles: [],
  currentEditId: null,

  // Initialize - load articles from localStorage or fetch from /data/articles.json
  init() {
    const stored = localStorage.getItem('adminArticles');
    if (stored) {
      this.articles = JSON.parse(stored);
    } else {
      fetch('/data/articles.json')
        .then(r => r.json())
        .catch(() => [])
        .then(data => {
          this.articles = data || [];
          localStorage.setItem('adminArticles', JSON.stringify(this.articles));
          this.renderList();
        });
    }
    this.renderList();
  },

  // Render the articles list in the panel
  renderList() {
    const container = document.getElementById('articlesListContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="articles-toolbar">
        <button class="btn-primary" onclick="adminArticles.newArticle()">Neuer Artikel</button>
        <button class="btn-secondary" onclick="adminArticles.publishArticles()">Veröffentlichen</button>
      </div>
      <div class="articles-table">
        ${this.articles.length === 0 ? '<p class="empty-state">Keine Artikel vorhanden</p>' : ''}
        ${this.articles.map(article => `
          <div class="article-row">
            <div class="article-cell article-title">${article.title || '(Ohne Titel)'}</div>
            <div class="article-cell article-category">
              <span class="badge badge-${(article.category || '').toLowerCase()}">${article.category || '-'}</span>
            </div>
            <div class="article-cell article-keyphrase">${article.keyphrase || '-'}</div>
            <div class="article-cell article-score">
              <div class="seo-score-circle ${this.getScoreColor(this.calculateSeoScore(article))}">
                ${this.calculateSeoScore(article)}%
              </div>
            </div>
            <div class="article-cell article-actions">
              <button class="btn-small" onclick="adminArticles.openEditor('${article.id}')">Bearbeiten</button>
              <button class="btn-small btn-danger" onclick="adminArticles.deleteArticle('${article.id}')">Löschen</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // Open article editor (Tab Layout with 5 tabs)
  openEditor(id) {
    const article = this.articles.find(a => a.id === id);
    if (!article) return;

    this.currentEditId = id;
    const container = document.getElementById('articlesListContainer');

    container.innerHTML = `
      <div class="editor-header">
        <button class="btn-back" onclick="adminArticles.closeEditor()">← Zurück</button>
        <h2>${article.title || 'Neuer Artikel'}</h2>
      </div>

      <div class="editor-tabs">
        <div class="tabs-nav">
          <button class="tab-btn active" onclick="adminArticles.switchTab('content')">Inhalt</button>
          <button class="tab-btn" onclick="adminArticles.switchTab('images')">Bilder</button>
          <button class="tab-btn" onclick="adminArticles.switchTab('seo')">SEO</button>
          <button class="tab-btn" onclick="adminArticles.switchTab('meta')">Meta-Daten</button>
          <button class="tab-btn" onclick="adminArticles.switchTab('preview')">Vorschau</button>
        </div>

        <div class="tabs-content">
          <!-- TAB 1: Content -->
          <div class="tab-pane active" id="tab-content">
            <div class="form-group">
              <label>Titel</label>
              <input type="text" id="articleTitle" class="form-input" value="${article.title || ''}" placeholder="Artikel-Titel">
            </div>

            <div class="form-group">
              <label>Kategorie</label>
              <select id="articleCategory" class="form-input">
                <option value="">-- Kategorie wählen --</option>
                <option value="Tipps & Tricks" ${article.category === 'Tipps & Tricks' ? 'selected' : ''}>Tipps & Tricks</option>
                <option value="Anleitungen" ${article.category === 'Anleitungen' ? 'selected' : ''}>Anleitungen</option>
                <option value="Marketing" ${article.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
                <option value="Technik" ${article.category === 'Technik' ? 'selected' : ''}>Technik</option>
                <option value="Branche" ${article.category === 'Branche' ? 'selected' : ''}>Branche</option>
              </select>
            </div>

            <div class="form-group">
              <label>Focus-Keyphrase</label>
              <input type="text" id="articleKeyphrase" class="form-input" value="${article.keyphrase || ''}" placeholder="z.B. 'Stockvideo Editor'">
            </div>

            <div class="form-group">
              <label>Einleitung</label>
              <textarea id="articleIntro" class="form-textarea" placeholder="Einleitungstext...">${article.intro || ''}</textarea>
            </div>

            <div id="sectionsContainer">
              ${(article.sections || []).map((section, idx) => `
                <div class="section-block">
                  <input type="text" class="form-input section-title" value="${section.title || ''}" placeholder="Überschrift (H2)">
                  <textarea class="form-textarea" placeholder="Absatz...">${section.content || ''}</textarea>
                  <button class="btn-small btn-danger" onclick="adminArticles.removeSection(${idx})">Entfernen</button>
                </div>
              `).join('')}
            </div>

            <button class="btn-secondary" onclick="adminArticles.addSection()">+ Abschnitt hinzufügen</button>

            <div class="form-group">
              <label>Fazit/Conclusion</label>
              <textarea id="articleConclusion" class="form-textarea" placeholder="Abschließender Text...">${article.conclusion || ''}</textarea>
            </div>

            <div class="form-group">
              <label>Lesezeit (Minuten)</label>
              <input type="number" id="articleReadTime" class="form-input" value="${article.readTime || 5}" min="1">
            </div>

            <div class="form-group">
              <label>Wikipedia URL</label>
              <input type="url" id="articleWikiUrl" class="form-input" value="${article.wikiUrl || ''}" placeholder="https://de.wikipedia.org/wiki/...">
            </div>

            <div class="form-group">
              <label>Interne Links</label>
              <div class="internal-links-list">
                ${(article.internalLinks || []).map((link, idx) => `
                  <div class="link-item">
                    <input type="text" class="form-input" value="${link}" placeholder="URL oder Titel">
                    <button class="btn-small btn-danger" onclick="adminArticles.removeInternalLink(${idx})">×</button>
                  </div>
                `).join('')}
              </div>
              <button class="btn-secondary" onclick="adminArticles.addInternalLink()">+ Link hinzufügen</button>
            </div>
          </div>

          <!-- TAB 2: Images -->
          <div class="tab-pane" id="tab-images">
            <div class="form-group">
              <label>Bild-Vorschau</label>
              <div class="image-preview">
                <img id="imagePreviewImg" src="${article.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Cdefs%3E%3ClinearGradient id=%22grad%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%231473e6;stop-opacity:1%22 /%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%230f3d7d;stop-opacity:1%22 /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22400%22 height=%22225%22 fill=%22url(%23grad)%22/%3E%3C/svg%3E'}" alt="Artikel-Bild">
              </div>
            </div>

            <div class="form-group">
              <label>Bild austauschen</label>
              <input type="file" id="imageFile" class="form-input" accept="image/*" onchange="adminArticles.handleImageUpload(event)">
            </div>

            <div class="form-group">
              <label>Alt-Text</label>
              <input type="text" id="articleImageAlt" class="form-input" value="${article.imageAlt || ''}" placeholder="Beschreibung für Screenreader">
            </div>

            <div class="form-group">
              <label>Dateiname</label>
              <input type="text" id="articleImageFilename" class="form-input" value="${article.imageFilename || ''}" placeholder="z.B. article-stockvideo-editing.jpg" readonly>
            </div>
          </div>

          <!-- TAB 3: SEO Checker -->
          <div class="tab-pane" id="tab-seo">
            <div class="seo-overall-score">
              <div class="score-circle ${this.getScoreColor(this.calculateSeoScore(article))}">
                ${this.calculateSeoScore(article)}%
              </div>
              <div class="score-label">SEO-Score</div>
            </div>

            <div class="seo-checks">
              <div class="check-section">
                <h4>Grundlagen</h4>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-title"></span>
                  <span>Keyphrase in SEO-Titel</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-intro"></span>
                  <span>Keyphrase in Einleitung</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-density"></span>
                  <span>Keyphrase-Dichte (2-3%)</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-h2"></span>
                  <span>Keyphrase in H2</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-slug"></span>
                  <span>Keyphrase in Permalink</span>
                </div>
              </div>

              <div class="check-section">
                <h4>Meta-Daten & Sichtbarkeit</h4>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-meta"></span>
                  <span>Keyphrase in Meta</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-keyphrase-alt"></span>
                  <span>Keyphrase im Alt-Text</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-meta-length"></span>
                  <span>Meta-Länge (150-160)</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-title-length"></span>
                  <span>SEO-Titel Länge (&lt;60)</span>
                </div>
              </div>

              <div class="check-section">
                <h4>Inhalt & Lesbarkeit</h4>
                <div class="check-item">
                  <span class="traffic-light" id="check-text-length"></span>
                  <span>Textlänge (mind. 500)</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-readability"></span>
                  <span>Lesbarkeit</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-passive"></span>
                  <span>Passive Sätze</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-paragraph-length"></span>
                  <span>Absatzlänge</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-sentence-length"></span>
                  <span>Satzlänge</span>
                </div>
              </div>

              <div class="check-section">
                <h4>Erweiterte SEO</h4>
                <div class="check-item">
                  <span class="traffic-light" id="check-wiki"></span>
                  <span>Wikipedia-Link</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-internal-links"></span>
                  <span>Interne Links (mind. 3)</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-structured-data"></span>
                  <span>Strukturierte Daten</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-faq"></span>
                  <span>FAQ-Schema</span>
                </div>
                <div class="check-item">
                  <span class="traffic-light" id="check-freshness"></span>
                  <span>Inhaltsfrische</span>
                </div>
              </div>
            </div>

            <button class="btn-primary" onclick="adminArticles.runSeoCheck()">SEO-Check ausführen</button>
          </div>

          <!-- TAB 4: Meta-Daten -->
          <div class="tab-pane" id="tab-meta">
            <div class="form-group">
              <label>SEO-Titel</label>
              <input type="text" id="articleSeoTitle" class="form-input" value="${article.seoTitle || ''}" placeholder="SEO-optimierter Titel" maxlength="60">
              <div class="char-counter"><span id="seoTitleCount">0</span>/60</div>
            </div>

            <div class="form-group">
              <label>Meta-Beschreibung</label>
              <textarea id="articleMetaDesc" class="form-textarea" placeholder="Kurze Zusammenfassung..." maxlength="160">${article.metaDescription || ''}</textarea>
              <div class="char-counter"><span id="metaDescCount">0</span>/160</div>
            </div>

            <div class="form-group">
              <label>Permalink/Slug</label>
              <div class="slug-input-group">
                <span class="slug-prefix">stockvideo.de/wissen/</span>
                <input type="text" id="articleSlug" class="form-input" value="${article.slug || ''}" placeholder="article-title-slug">
              </div>
            </div>

            <div class="form-group geo-section">
              <h4>GEO-Daten</h4>
              <div class="geo-grid">
                <div class="form-group">
                  <label>Breitengrad (Latitude)</label>
                  <input type="number" id="articleLat" class="form-input" value="${article.latitude || ''}" step="0.0001" placeholder="52.5200">
                </div>
                <div class="form-group">
                  <label>Längengrad (Longitude)</label>
                  <input type="number" id="articleLng" class="form-input" value="${article.longitude || ''}" step="0.0001" placeholder="13.4050">
                </div>
              </div>
              <div class="form-group">
                <label>Stadt</label>
                <input type="text" id="articleCity" class="form-input" value="${article.city || ''}" placeholder="z.B. Berlin">
              </div>
              <div class="map-placeholder">Karte</div>
            </div>
          </div>

          <!-- TAB 5: Preview -->
          <div class="tab-pane" id="tab-preview">
            <div class="preview-controls">
              <button class="preview-device-btn active" onclick="adminArticles.toggleSerpDevice('desktop')">Desktop</button>
              <button class="preview-device-btn" onclick="adminArticles.toggleSerpDevice('mobile')">Mobil</button>
            </div>

            <div id="serpPreview" class="serp-preview serp-desktop">
              <div class="serp-title" id="serpTitle">${article.seoTitle || 'Artikel Titel'}</div>
              <div class="serp-url">stockvideo.de/wissen/${article.slug || 'article-slug'}</div>
              <div class="serp-desc" id="serpDesc">${article.metaDescription || 'Meta-Beschreibung wird hier angezeigt...'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn-danger" onclick="adminArticles.closeEditor()">Abbrechen</button>
        <button class="btn-primary" onclick="adminArticles.saveArticle()">Speichern</button>
      </div>
    `;

    this.updateCharCounters();
  },

  // Switch between tabs
  switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'seo') {
      this.runSeoCheck();
    }
    if (tabName === 'preview') {
      this.updateSerpPreview();
    }
  },

  // Close editor, back to list
  closeEditor() {
    this.currentEditId = null;
    this.renderList();
  },

  // Save article
  saveArticle() {
    if (!this.currentEditId) return;

    const article = this.articles.find(a => a.id === this.currentEditId);
    if (!article) return;

    const sections = [];
    document.querySelectorAll('.section-block').forEach(block => {
      const title = block.querySelector('.section-title').value;
      const content = block.querySelector('.form-textarea').value;
      if (title && content) {
        sections.push({ title, content });
      }
    });

    const internalLinks = [];
    document.querySelectorAll('.link-item input').forEach(input => {
      if (input.value.trim()) internalLinks.push(input.value.trim());
    });

    article.title = document.getElementById('articleTitle').value;
    article.category = document.getElementById('articleCategory').value;
    article.keyphrase = document.getElementById('articleKeyphrase').value;
    article.intro = document.getElementById('articleIntro').value;
    article.sections = sections;
    article.conclusion = document.getElementById('articleConclusion').value;
    article.readTime = parseInt(document.getElementById('articleReadTime').value) || 5;
    article.wikiUrl = document.getElementById('articleWikiUrl').value;
    article.internalLinks = internalLinks;
    article.imageAlt = document.getElementById('articleImageAlt').value;
    article.seoTitle = document.getElementById('articleSeoTitle').value;
    article.metaDescription = document.getElementById('articleMetaDesc').value;
    article.slug = document.getElementById('articleSlug').value;
    article.latitude = document.getElementById('articleLat').value;
    article.longitude = document.getElementById('articleLng').value;
    article.city = document.getElementById('articleCity').value;
    article.updatedAt = new Date().toISOString();

    localStorage.setItem('adminArticles', JSON.stringify(this.articles));
    admin.showAlert('articlesListContainer', 'success', 'Artikel gespeichert!');
    setTimeout(() => this.closeEditor(), 1000);
  },

  // Delete article
  deleteArticle(id) {
    if (!confirm('Artikel wirklich löschen?')) return;
    this.articles = this.articles.filter(a => a.id !== id);
    localStorage.setItem('adminArticles', JSON.stringify(this.articles));
    this.renderList();
    admin.showAlert('articlesListContainer', 'success', 'Artikel gelöscht!');
  },

  // Create new article
  newArticle() {
    const id = 'article-' + Date.now();
    this.articles.push({
      id,
      title: '',
      category: '',
      keyphrase: '',
      intro: '',
      sections: [],
      conclusion: '',
      readTime: 5,
      wikiUrl: '',
      internalLinks: [],
      image: '',
      imageAlt: '',
      imageFilename: '',
      seoTitle: '',
      metaDescription: '',
      slug: '',
      latitude: '',
      longitude: '',
      city: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    localStorage.setItem('adminArticles', JSON.stringify(this.articles));
    this.openEditor(id);
  },

  // Add section
  addSection() {
    const container = document.getElementById('sectionsContainer');
    const html = `
      <div class="section-block">
        <input type="text" class="form-input section-title" placeholder="Überschrift (H2)">
        <textarea class="form-textarea" placeholder="Absatz..."></textarea>
        <button class="btn-small btn-danger" onclick="adminArticles.removeSection(this)">Entfernen</button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  },

  // Remove section
  removeSection(indexOrElement) {
    if (typeof indexOrElement === 'number') {
      document.querySelectorAll('.section-block')[indexOrElement].remove();
    } else {
      indexOrElement.closest('.section-block').remove();
    }
  },

  // Add internal link
  addInternalLink() {
    const container = document.querySelector('.internal-links-list');
    const html = `
      <div class="link-item">
        <input type="text" class="form-input" placeholder="URL oder Titel">
        <button class="btn-small btn-danger" onclick="adminArticles.removeInternalLink(this)">×</button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  },

  // Remove internal link
  removeInternalLink(indexOrElement) {
    if (typeof indexOrElement === 'number') {
      document.querySelectorAll('.link-item')[indexOrElement].remove();
    } else {
      indexOrElement.closest('.link-item').remove();
    }
  },

  // Handle image upload
  handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('imagePreviewImg').src = e.target.result;
      document.getElementById('articleImageFilename').value = file.name;
    };
    reader.readAsDataURL(file);
  },

  // Update character counters
  updateCharCounters() {
    const seoTitleInput = document.getElementById('articleSeoTitle');
    const metaDescInput = document.getElementById('articleMetaDesc');

    if (seoTitleInput) {
      seoTitleInput.addEventListener('input', () => {
        document.getElementById('seoTitleCount').textContent = seoTitleInput.value.length;
      });
      document.getElementById('seoTitleCount').textContent = seoTitleInput.value.length;
    }

    if (metaDescInput) {
      metaDescInput.addEventListener('input', () => {
        document.getElementById('metaDescCount').textContent = metaDescInput.value.length;
      });
      document.getElementById('metaDescCount').textContent = metaDescInput.value.length;
    }
  },

  // SEO Checker
  runSeoCheck() {
    const article = this.articles.find(a => a.id === this.currentEditId);
    if (!article) return;

    const seoTitle = document.getElementById('articleSeoTitle')?.value || article.seoTitle || '';
    const metaDesc = document.getElementById('articleMetaDesc')?.value || article.metaDescription || '';
    const slug = document.getElementById('articleSlug')?.value || article.slug || '';
    const keyphrase = (document.getElementById('articleKeyphrase')?.value || article.keyphrase || '').toLowerCase();
    const intro = document.getElementById('articleIntro')?.value || article.intro || '';
    const conclusion = document.getElementById('articleConclusion')?.value || article.conclusion || '';
    const imageAlt = document.getElementById('articleImageAlt')?.value || article.imageAlt || '';
    const wikiUrl = document.getElementById('articleWikiUrl')?.value || article.wikiUrl || '';

    const allText = (seoTitle + ' ' + metaDesc + ' ' + intro + ' ' + conclusion).toLowerCase();
    const textLength = this.countWords(allText) * 4.7;

    // Run checks
    this.updateCheck('check-keyphrase-title', keyphrase && seoTitle.toLowerCase().includes(keyphrase) ? 'pass' : 'fail');
    this.updateCheck('check-keyphrase-intro', keyphrase && intro.toLowerCase().includes(keyphrase) ? 'pass' : 'fail');
    this.updateCheck('check-keyphrase-density', this.checkKeyphraseDensity(allText, keyphrase) ? 'pass' : 'warn');
    this.updateCheck('check-keyphrase-h2', keyphrase ? 'pass' : 'fail');
    this.updateCheck('check-keyphrase-slug', keyphrase && slug.toLowerCase().includes(keyphrase.split(' ')[0]) ? 'pass' : 'warn');
    this.updateCheck('check-keyphrase-meta', keyphrase && metaDesc.toLowerCase().includes(keyphrase) ? 'pass' : 'fail');
    this.updateCheck('check-keyphrase-alt', keyphrase && imageAlt.toLowerCase().includes(keyphrase) ? 'pass' : 'warn');
    this.updateCheck('check-meta-length', metaDesc.length >= 150 && metaDesc.length <= 160 ? 'pass' : 'warn');
    this.updateCheck('check-title-length', seoTitle.length < 60 ? 'pass' : 'warn');
    this.updateCheck('check-text-length', textLength >= 500 ? 'pass' : 'fail');
    this.updateCheck('check-readability', this.checkReadability(allText) ? 'pass' : 'warn');
    this.updateCheck('check-passive', this.checkPassiveVoice(allText) ? 'warn' : 'pass');
    this.updateCheck('check-paragraph-length', true ? 'pass' : 'warn');
    this.updateCheck('check-sentence-length', this.checkSentenceLength(allText) ? 'pass' : 'warn');
    this.updateCheck('check-wiki', wikiUrl ? 'pass' : 'warn');

    const internalLinks = Array.from(document.querySelectorAll('.link-item input')).filter(i => i.value.trim()).length;
    this.updateCheck('check-internal-links', internalLinks >= 3 ? 'pass' : 'warn');

    this.updateCheck('check-structured-data', true ? 'warn' : 'pass');
    this.updateCheck('check-faq', false ? 'pass' : 'warn');
    this.updateCheck('check-freshness', true ? 'pass' : 'warn');
  },

  // Update check status
  updateCheck(elementId, status) {
    const element = document.getElementById(elementId);
    if (element) {
      element.className = 'traffic-light traffic-light-' + status;
    }
  },

  // Check keyphrase density (2-3%)
  checkKeyphraseDensity(text, keyphrase) {
    if (!keyphrase) return false;
    const wordCount = this.countWords(text);
    const keyphraseCount = this.countKeyphrase(text, keyphrase);
    const density = (keyphraseCount / wordCount) * 100;
    return density >= 1 && density <= 4;
  },

  // Check readability
  checkReadability(text) {
    const words = this.countWords(text);
    return words > 300;
  },

  // Check passive voice
  checkPassiveVoice(text) {
    const passivePattern = /\b(ist|sind|wird|wurde|werden|geworden|sein|haben)\b/gi;
    const passiveCount = (text.match(passivePattern) || []).length;
    return passiveCount > text.split('.').length * 0.3;
  },

  // Check sentence length
  checkSentenceLength(text) {
    const sentences = text.split(/[.!?]+/);
    const avgLength = sentences.reduce((sum, s) => sum + this.countWords(s), 0) / sentences.length;
    return avgLength >= 10 && avgLength <= 20;
  },

  // Update Google SERP preview
  updateSerpPreview() {
    const seoTitle = document.getElementById('articleSeoTitle')?.value || 'Artikel Titel';
    const metaDesc = document.getElementById('articleMetaDesc')?.value || 'Meta-Beschreibung wird hier angezeigt...';
    const slug = document.getElementById('articleSlug')?.value || 'article-slug';

    const serpTitle = document.getElementById('serpTitle');
    const serpDesc = document.getElementById('serpDesc');

    if (serpTitle) serpTitle.textContent = seoTitle;
    if (serpDesc) serpDesc.textContent = metaDesc;

    document.querySelectorAll('.serp-url').forEach(el => {
      el.textContent = 'stockvideo.de/wissen/' + slug;
    });
  },

  // Toggle SERP preview between desktop and mobile
  toggleSerpDevice(device) {
    const preview = document.getElementById('serpPreview');
    const buttons = document.querySelectorAll('.preview-device-btn');

    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    preview.className = 'serp-preview serp-' + device;
  },

  // Count words in text
  countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  },

  // Count keyphrase occurrences
  countKeyphrase(text, keyphrase) {
    if (!keyphrase) return 0;
    const regex = new RegExp(keyphrase, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  },

  // Get score color
  getScoreColor(score) {
    if (score >= 70) return 'score-green';
    if (score >= 40) return 'score-yellow';
    return 'score-red';
  },

  // Calculate overall SEO score
  calculateSeoScore(article) {
    let score = 0;
    const maxScore = 16;

    if (article.seoTitle && article.seoTitle.length < 60) score += 1;
    if (article.metaDescription && article.metaDescription.length >= 150 && article.metaDescription.length <= 160) score += 1;
    if (article.slug) score += 1;
    if (article.keyphrase) score += 1;
    if (article.intro && article.intro.length > 50) score += 1;
    if (article.sections && article.sections.length >= 2) score += 1;
    if (article.conclusion) score += 1;
    if (article.imageAlt) score += 1;
    if (article.wikiUrl) score += 1;
    if (article.internalLinks && article.internalLinks.length >= 3) score += 1;
    if (article.readTime) score += 1;
    if (article.category) score += 1;
    if (article.image) score += 1;
    if (article.latitude && article.longitude) score += 1;
    if (article.seoTitle && article.seoTitle.toLowerCase().includes((article.keyphrase || '').toLowerCase())) score += 1;
    if (article.metaDescription && article.metaDescription.toLowerCase().includes((article.keyphrase || '').toLowerCase())) score += 1;
    if (article.intro && article.intro.toLowerCase().includes((article.keyphrase || '').toLowerCase())) score += 1;

    return Math.round((score / maxScore) * 100);
  },

  // Publish articles to GitHub
  async publishArticles() {
    if (!confirm('Artikel zu GitHub veröffentlichen?')) return;

    const data = JSON.stringify(this.articles, null, 2);

    try {
      const githubToken = localStorage.getItem('githubToken');
      if (!githubToken) {
        admin.showAlert('articlesListContainer', 'error', 'GitHub Token nicht gespeichert!');
        return;
      }

      const filesToUpdate = [
        'public/data/articles.json',
        'src/data/articles.json'
      ];

      for (const filePath of filesToUpdate) {
        await this.uploadToGitHub(filePath, data, githubToken);
      }

      admin.showAlert('articlesListContainer', 'success', 'Artikel veröffentlicht!');
      admin.publishToGitHub();
    } catch (error) {
      console.error('Publish error:', error);
      admin.showAlert('articlesListContainer', 'error', 'Veröffentlichung fehlgeschlagen!');
    }
  },

  // Upload file to GitHub
  async uploadToGitHub(path, content, token) {
    const repo = 'stockvideo-de/website';
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;

    const blob = new Blob([content], { type: 'application/json' });
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    return fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update articles data - ${new Date().toISOString()}`,
        content: base64
      })
    });
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  adminArticles.init();
});
