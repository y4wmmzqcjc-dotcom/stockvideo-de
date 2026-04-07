// FORCE_DEFAULT_HASH: ensure admin123 login works in every browser
(function(){try{var DEFAULT="240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";var cur=localStorage.getItem("adminPasswordHash");if(!cur||cur.length!==64){localStorage.setItem("adminPasswordHash",DEFAULT);}}catch(e){}})();

// ========== AUTHENTICATION MODULE ==========
        window.auth = {
            maxOTPAttempts: 3,
            lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
            otpValidityMs: 5 * 60 * 1000, // 5 minutes

            currentOTP: null,
            otpTimestamp: null,
            otpAttempts: 0,
            lockoutEndTime: null,

            init() {
                this.checkLockout();
                if (!localStorage.getItem('adminPasswordHash')) {
                    // Set default admin password: "admin123"
                    const defaultPassword = 'admin123';
                    const hash = CryptoJS.SHA256(defaultPassword).toString();
                    localStorage.setItem('adminPasswordHash', hash);
                }
                document.getElementById('passwordInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.verifyPassword();
                });
                document.getElementById('otpInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.verifyOTP();
                });
            },

            checkLockout() {
                const lockoutEnd = localStorage.getItem('adminLockoutEnd');
                if (lockoutEnd && Date.now() < parseInt(lockoutEnd)) {
                    this.lockoutEndTime = parseInt(lockoutEnd);
                    this.showLockout();
                    this.startLockoutTimer();
                } else {
                    localStorage.removeItem('adminLockoutEnd');
                    this.lockoutEndTime = null;
                }
            },

            showLockout() {
                document.getElementById('authStep1').style.display = 'none';
                document.getElementById('authStep2').style.display = 'none';
                document.getElementById('lockoutDisplay').style.display = 'block';
            },

            startLockoutTimer() {
                const updateTimer = () => {
                    const remaining = Math.max(0, this.lockoutEndTime - Date.now());
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    document.getElementById('lockoutTimer').textContent =
                        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                    if (remaining > 0) {
                        setTimeout(updateTimer, 1000);
                    } else {
                        this.lockoutEndTime = null;
                        localStorage.removeItem('adminLockoutEnd');
                        location.reload();
                    }
                };
                updateTimer();
            },

            verifyPassword() {
                const password = document.getElementById('passwordInput').value;
                const alert = document.getElementById('passwordAlert');

                if (!password) {
                    alert.innerHTML = '<div class="alert alert-error">Bitte geben Sie ein Passwort ein</div>';
                    return;
                }

                const hash = CryptoJS.SHA256(password).toString();
                const correctHash = localStorage.getItem('adminPasswordHash');

                if (hash === correctHash) {
                    alert.innerHTML = '';
                    this.startOTPProcess();
                } else {
                    alert.innerHTML = '<div class="alert alert-error">Falsches Passwort</div>';
                }
            },

            startOTPProcess() {
                const settings = this.loadSettings();
                if (!settings.emailJS || !settings.adminEmail) {
                    document.getElementById('authStep1').style.display = 'none';
                    document.getElementById('authStep2').style.display = 'none';
                    this.authenticateWithoutOTP();
                    return;
                }

                this.sendOTP(settings);
            },

            sendOTP(settings) {
                const otp = Math.floor(Math.random() * 900000) + 100000;
                this.currentOTP = otp;
                this.otpTimestamp = Date.now();
                this.otpAttempts = 0;

                const email = settings.adminEmail;
                document.getElementById('otpEmail').textContent = email;

                if (typeof emailjs === 'undefined') {
                    // EmailJS not loaded – show OTP in console for dev/testing
                    console.warn('EmailJS not loaded. OTP code:', otp);
                    document.getElementById('authStep1').style.display = 'none';
                    document.getElementById('authStep2').style.display = 'block';
                    document.getElementById('otpInput').focus();
                    return;
                }

                emailjs.init(settings.emailJS.publicKey);

                emailjs.send(
                    settings.emailJS.serviceId,
                    settings.emailJS.templateId,
                    {
                        to_email: email,
                        otp_code: otp.toString()
                    }
                ).then(() => {
                    document.getElementById('authStep1').style.display = 'none';
                    document.getElementById('authStep2').style.display = 'block';
                    document.getElementById('otpInput').focus();
                }).catch((error) => {
                    console.error('EmailJS Error:', error);
                    const alert = document.getElementById('otpAlert');
                    alert.innerHTML = '<div class="alert alert-error">Fehler beim Versenden des OTP-Codes</div>';
                });
            },

            verifyOTP() {
                const inputOTP = document.getElementById('otpInput').value;
                const alert = document.getElementById('otpAlert');

                if (!inputOTP) {
                    alert.innerHTML = '<div class="alert alert-error">Bitte geben Sie den Code ein</div>';
                    return;
                }

                if (Date.now() - this.otpTimestamp > this.otpValidityMs) {
                    alert.innerHTML = '<div class="alert alert-error">OTP-Code ist abgelaufen. Bitte versuchen Sie es erneut.</div>';
                    this.resetOTPProcess();
                    return;
                }

                this.otpAttempts++;
                document.getElementById('otpAttempts').textContent = this.otpAttempts;

                if (parseInt(inputOTP) === this.currentOTP) {
                    alert.innerHTML = '';
                    this.authenticateWithoutOTP();
                } else {
                    if (this.otpAttempts >= this.maxOTPAttempts) {
                        const lockoutEnd = Date.now() + this.lockoutDurationMs;
                        localStorage.setItem('adminLockoutEnd', lockoutEnd.toString());
                        this.lockoutEndTime = lockoutEnd;
                        this.showLockout();
                        this.startLockoutTimer();
                    } else {
                        alert.innerHTML = '<div class="alert alert-error">Ungültiger Code. Bitte versuchen Sie es erneut.</div>';
                    }
                }
            },

            resetOTPProcess() {
                document.getElementById('otpInput').value = '';
                document.getElementById('otpAttempts').textContent = '0';
                this.startOTPProcess();
            },

            backToPassword() {
                document.getElementById('authStep1').style.display = 'block';
                document.getElementById('authStep2').style.display = 'none';
                document.getElementById('otpInput').value = '';
                document.getElementById('otpAttempts').textContent = '0';
                document.getElementById('passwordInput').focus();
            },

            authenticateWithoutOTP() {
                localStorage.setItem('adminAuthenticated', 'true');
                document.getElementById('authScreen').style.display = 'none';
                document.getElementById('adminLayout').style.display = 'flex';
                admin.init();
            },

            logout() {
                if (confirm('Wirklich abmelden?')) {
                    localStorage.removeItem('adminAuthenticated');
                    location.reload();
                }
            },

            loadSettings() {
                const defaults = {
                    emailJS: {
                        serviceId: '',
                        templateId: '',
                        publicKey: ''
                    },
                    adminEmail: '',
                    gitHub: {
                        token: '',
                        repo: 'y4wmmzqcjc-dotcom/stockvideo-de',
                        branch: 'main'
                    }
                };

                const saved = JSON.parse(localStorage.getItem('adminSettings') || '{}');
                return { ...defaults, ...saved };
            }
        };

        // ========== ADMIN MODULE ==========
        window.admin = {
            videos: [],
            categories: [],
            content: {},
            designVariables: {},
            editingVideoId: null,
            editingCategoryId: null,

            init() {
                this.loadVideos();
                this.loadCategories();
                this.loadPageContent();
                this.loadDesignVariables();
                this.loadSettings();
                this.updateDashboard();

                // Update nav items
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.addEventListener('click', () => {
                        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    });
                });
            },

            switchPanel(panel) {
                document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${panel}`).classList.add('active');

                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                event.target.closest('.nav-item').classList.add('active');
            },

            // ===== DASHBOARD =====
            updateDashboard() {
                this.loadVideos();
                this.loadCategories();

                document.getElementById('statVideos').textContent = this.videos.length;
                document.getElementById('statCategories').textContent = this.categories.length;

                const lastChange = localStorage.getItem('adminLastChange');
                if (lastChange) {
                    const date = new Date(lastChange);
                    document.getElementById('statLastChange').textContent = date.toLocaleDateString('de-DE');
                    document.getElementById('statLastChangeTime').textContent = date.toLocaleTimeString('de-DE');
                } else {
                    document.getElementById('statLastChange').textContent = '-';
                    document.getElementById('statLastChangeTime').textContent = '';
                }

                this.refreshDeployStatus();
            },

            refreshDeployStatus() {
                const settings = auth.loadSettings();
                if (!settings.gitHub.token) {
                    document.getElementById('statDeployStatus').textContent = '⚠️';
                    document.getElementById('statDeployTime').textContent = 'GitHub nicht konfiguriert';
                    return;
                }

                const repo = settings.gitHub.repo;
                const branch = settings.gitHub.branch;

                fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, {
                    headers: {
                        'Authorization': `token ${settings.gitHub.token}`
                    }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.commit) {
                        document.getElementById('statDeployStatus').textContent = '✅';
                        const date = new Date(data.commit.author.date);
                        document.getElementById('statDeployTime').textContent = date.toLocaleTimeString('de-DE');
                    } else {
                        throw new Error('No commit data');
                    }
                })
                .catch(err => {
                    console.error('GitHub Error:', err);
                    document.getElementById('statDeployStatus').textContent = '❌';
                    document.getElementById('statDeployTime').textContent = 'Fehler beim Abrufen';
                });
            },

            // ===== VIDEOS =====
            loadVideos() {
                const stored = localStorage.getItem('adminVideos');
                this.videos = stored ? JSON.parse(stored) : [];
                this.renderVideosList();
            },

            renderVideosList() {
                const container = document.getElementById('videosList');
                if (this.videos.length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎬</div><div class="empty-state-title">Keine Videos</div><p>Erstellen Sie Ihr erstes Video</p></div>';
                    return;
                }

                container.innerHTML = this.videos.map((video, idx) => `
                    <div class="list-item">
                        ${video.thumbnail ? `<img src="${video.thumbnail}" class="thumbnail-preview" onerror="this.style.display='none'">` : ''}
                        <div class="list-item-content">
                            <div class="list-item-title">${video.title}</div>
                            <div class="list-item-meta">${video.category} • ${video.resolution} • €${video.prices.web}</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="button button-small button-secondary" onclick="admin.editVideo(${idx})">Bearbeiten</button>
                            <button class="button button-small button-danger" onclick="admin.deleteVideo(${idx})">Löschen</button>
                        </div>
                    </div>
                `).join('');
            },

            openVideoModal() {
                this.editingVideoId = null;
                document.getElementById('videoModalTitle').textContent = 'Neues Video';
                document.getElementById('videoModalTitle_Input').value = '';
                document.getElementById('videoModalSlug').value = '';
                document.getElementById('videoModalDescription').value = '';
                document.getElementById('videoModalCategory').value = '';
                document.getElementById('videoModalTags').value = '';
                document.getElementById('videoModalResolution').value = '4K';
                document.getElementById('videoModalDuration').value = '';
                document.getElementById('videoModalFPS').value = '';
                document.getElementById('videoModalPriceWeb').value = '';
                document.getElementById('videoModalPriceStandard').value = '';
                document.getElementById('videoModalPricePremium').value = '';
                document.getElementById('videoModalThumbnail').value = '';
                document.getElementById('videoModalR2Key').value = '';
                document.getElementById('videoModalFeatured').checked = false;

                this.updateCategoryDropdown();
                this.renderGradientInputs(null);

                document.getElementById('videoModal').classList.add('active');
                document.getElementById('videoModalTitle_Input').focus();
            },

            editVideo(idx) {
                this.editingVideoId = idx;
                const video = this.videos[idx];

                document.getElementById('videoModalTitle').textContent = 'Video bearbeiten';
                document.getElementById('videoModalTitle_Input').value = video.title;
                document.getElementById('videoModalSlug').value = video.slug;
                document.getElementById('videoModalDescription').value = video.description;
                document.getElementById('videoModalTags').value = (video.tags || []).join(', ');
                document.getElementById('videoModalResolution').value = video.resolution;
                document.getElementById('videoModalDuration').value = video.duration;
                document.getElementById('videoModalFPS').value = video.fps;
                document.getElementById('videoModalPriceWeb').value = video.prices.web;
                document.getElementById('videoModalPriceStandard').value = video.prices.standard;
                document.getElementById('videoModalPricePremium').value = video.prices.premium;
                document.getElementById('videoModalThumbnail').value = video.thumbnail;
                document.getElementById('videoModalR2Key').value = video.r2Key;
                document.getElementById('videoModalFeatured').checked = video.featured;

                this.updateCategoryDropdown();
                document.getElementById('videoModalCategory').value = video.category;
                this.renderGradientInputs(video.gradient);

                document.getElementById('videoModal').classList.add('active');
            },

            closeVideoModal() {
                document.getElementById('videoModal').classList.remove('active');
                this.editingVideoId = null;
            },

            updateCategoryDropdown() {
                const dropdown = document.getElementById('videoModalCategory');
                dropdown.innerHTML = '<option value="">-- Wählen Sie eine Kategorie --</option>' +
                    this.categories.map(cat => `<option value="${cat.slug}">${cat.label}</option>`).join('');
            },

            renderGradientInputs(gradient) {
                const container = document.getElementById('videoModalGradients');
                if (!gradient) {
                    gradient = [
                        { color: '#1473e6', position: 0 },
                        { color: '#0d5fcf', position: 100 }
                    ];
                }

                container.innerHTML = gradient.map((g, idx) => `
                    <div class="form-row" style="align-items: flex-end;">
                        <div style="flex: 1;">
                            <label class="form-label">Farbe ${idx + 1}</label>
                            <div class="color-input-group">
                                <input type="color" class="color-input gradient-color-${idx}" value="${g.color}">
                                <input type="text" class="text-input-small" value="${g.color}" readonly>
                            </div>
                        </div>
                        <div>
                            <label class="form-label">Position (%)</label>
                            <input type="number" class="form-input" style="width: 100px;" value="${g.position}" min="0" max="100">
                        </div>
                    </div>
                `).join('');

                gradient.forEach((_, idx) => {
                    const colorInput = document.querySelector(`.gradient-color-${idx}`);
                    if (colorInput) {
                        colorInput.addEventListener('input', (e) => {
                            const textInput = colorInput.nextElementSibling;
                            textInput.value = e.target.value;
                        });
                    }
                });
            },

            saveVideo() {
                const title = document.getElementById('videoModalTitle_Input').value;
                const slug = document.getElementById('videoModalSlug').value || this.generateSlug(title);

                if (!title) {
                    alert('Bitte geben Sie einen Titel ein');
                    return;
                }

                const gradientInputs = document.querySelectorAll('#videoModalGradients .form-row');
                const gradient = Array.from(gradientInputs).map((row, idx) => ({
                    color: row.querySelector(`.gradient-color-${idx}`)?.value || '#1473e6',
                    position: parseInt(row.querySelector('input[type="number"]').value) || 0
                }));

                const video = {
                    id: this.editingVideoId !== null ? this.videos[this.editingVideoId].id : Date.now().toString(),
                    title,
                    slug,
                    description: document.getElementById('videoModalDescription').value,
                    category: document.getElementById('videoModalCategory').value,
                    tags: document.getElementById('videoModalTags').value.split(',').map(t => t.trim()).filter(Boolean),
                    resolution: document.getElementById('videoModalResolution').value,
                    duration: parseInt(document.getElementById('videoModalDuration').value) || 0,
                    fps: parseInt(document.getElementById('videoModalFPS').value) || 0,
                    prices: {
                        web: parseFloat(document.getElementById('videoModalPriceWeb').value) || 0,
                        standard: parseFloat(document.getElementById('videoModalPriceStandard').value) || 0,
                        premium: parseFloat(document.getElementById('videoModalPricePremium').value) || 0
                    },
                    thumbnail: document.getElementById('videoModalThumbnail').value,
                    r2Key: document.getElementById('videoModalR2Key').value,
                    featured: document.getElementById('videoModalFeatured').checked,
                    gradient
                };

                if (this.editingVideoId !== null) {
                    this.videos[this.editingVideoId] = video;
                } else {
                    this.videos.push(video);
                }

                localStorage.setItem('adminVideos', JSON.stringify(this.videos));
                localStorage.setItem('adminLastChange', new Date().toISOString());
                this.loadVideos();
                this.closeVideoModal();
                this.showAlert('videosAlert', 'success', 'Video gespeichert');
            },

            deleteVideo(idx) {
                if (confirm('Wirklich löschen?')) {
                    this.videos.splice(idx, 1);
                    localStorage.setItem('adminVideos', JSON.stringify(this.videos));
                    localStorage.setItem('adminLastChange', new Date().toISOString());
                    this.loadVideos();
                    this.showAlert('videosAlert', 'success', 'Video gelöscht');
                }
            },

            generateSlug(title) {
                return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            },

            // ===== CATEGORIES =====
            loadCategories() {
                const stored = localStorage.getItem('adminCategories');
                this.categories = stored ? JSON.parse(stored) : [];
                this.renderCategoriesList();
            },

            renderCategoriesList() {
                const container = document.getElementById('categoriesList');
                if (this.categories.length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">Keine Kategorien</div><p>Erstellen Sie Ihre erste Kategorie</p></div>';
                    return;
                }

                container.innerHTML = this.categories.map((cat, idx) => `
                    <div class="list-item">
                        <div style="font-size: 2rem; margin-right: 1rem;">${cat.icon}</div>
                        <div class="list-item-content">
                            <div class="list-item-title">${cat.label}</div>
                            <div class="list-item-meta">${cat.slug}</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="button button-small button-secondary" onclick="admin.editCategory(${idx})">Bearbeiten</button>
                            <button class="button button-small button-danger" onclick="admin.deleteCategory(${idx})">Löschen</button>
                        </div>
                    </div>
                `).join('');
            },

            openCategoryModal() {
                this.editingCategoryId = null;
                document.getElementById('categoryModalTitle').textContent = 'Neue Kategorie';
                document.getElementById('categoryModalLabel').value = '';
                document.getElementById('categoryModalSlug').value = '';
                document.getElementById('categoryModalDescription').value = '';
                document.getElementById('categoryModalIcon').value = '';
                document.getElementById('categoryModalOrder').value = '';
                document.getElementById('categoryModal').classList.add('active');
                document.getElementById('categoryModalLabel').focus();
            },

            editCategory(idx) {
                this.editingCategoryId = idx;
                const cat = this.categories[idx];
                document.getElementById('categoryModalTitle').textContent = 'Kategorie bearbeiten';
                document.getElementById('categoryModalLabel').value = cat.label;
                document.getElementById('categoryModalSlug').value = cat.slug;
                document.getElementById('categoryModalDescription').value = cat.description;
                document.getElementById('categoryModalIcon').value = cat.icon;
                document.getElementById('categoryModalOrder').value = cat.order;
                document.getElementById('categoryModal').classList.add('active');
            },

            closeCategoryModal() {
                document.getElementById('categoryModal').classList.remove('active');
                this.editingCategoryId = null;
            },

            saveCategory() {
                const label = document.getElementById('categoryModalLabel').value;
                const slug = document.getElementById('categoryModalSlug').value || this.generateSlug(label);

                if (!label) {
                    alert('Bitte geben Sie einen Namen ein');
                    return;
                }

                const category = {
                    id: this.editingCategoryId !== null ? this.categories[this.editingCategoryId].id : Date.now().toString(),
                    label,
                    slug,
                    description: document.getElementById('categoryModalDescription').value,
                    icon: document.getElementById('categoryModalIcon').value,
                    order: parseInt(document.getElementById('categoryModalOrder').value) || 0
                };

                if (this.editingCategoryId !== null) {
                    this.categories[this.editingCategoryId] = category;
                } else {
                    this.categories.push(category);
                }

                localStorage.setItem('adminCategories', JSON.stringify(this.categories));
                localStorage.setItem('adminLastChange', new Date().toISOString());
                this.loadCategories();
                this.closeCategoryModal();
                this.showAlert('categoriesAlert', 'success', 'Kategorie gespeichert');
            },

            deleteCategory(idx) {
                if (confirm('Wirklich löschen?')) {
                    this.categories.splice(idx, 1);
                    localStorage.setItem('adminCategories', JSON.stringify(this.categories));
                    localStorage.setItem('adminLastChange', new Date().toISOString());
                    this.loadCategories();
                    this.showAlert('categoriesAlert', 'success', 'Kategorie gelöscht');
                }
            },

            // ===== PAGE CONTENT =====
            loadPageContent() {
                const stored = localStorage.getItem('adminPageContent');
                this.content = stored ? JSON.parse(stored) : {
                    hero: { title: '', subtitle: '', searchPlaceholder: '' },
                    features: [
                        { icon: '🎬', title: '', description: '' },
                        { icon: '🔒', title: '', description: '' },
                        { icon: '⚡', title: '', description: '' },
                        { icon: '💰', title: '', description: '' }
                    ],
                    pricing: [
                        { label: '', resolution: '', price: '', description: '', featured: false },
                        { label: '', resolution: '', price: '', description: '', featured: false },
                        { label: '', resolution: '', price: '', description: '', featured: false },
                        { label: '', resolution: '', price: '', description: '', featured: false }
                    ],
                    nav: { links: [], ctaText: '' },
                    footer: { copyright: '', columns: [] },
                    seo: { title: '', description: '' }
                };

                this.renderPageContent();
            },

            renderPageContent() {
                // Hero
                document.getElementById('contentHeroTitle').value = this.content.hero?.title || '';
                document.getElementById('contentHeroSubtitle').value = this.content.hero?.subtitle || '';
                document.getElementById('contentHeroSearchPlaceholder').value = this.content.hero?.searchPlaceholder || '';

                // Features
                const featuresContainer = document.getElementById('contentFeaturesContainer');
                featuresContainer.innerHTML = (this.content.features || []).map((f, idx) => `
                    <div class="form-section" style="margin-bottom: 1rem;">
                        <div class="form-section-title">Feature ${idx + 1}</div>
                        <div class="form-row full">
                            <div>
                                <label class="form-label">Icon</label>
                                <input type="text" class="form-input" value="${f.icon}" placeholder="Icon Emoji" data-feature-icon="${idx}">
                            </div>
                        </div>
                        <div class="form-row full">
                            <div>
                                <label class="form-label">Titel</label>
                                <input type="text" class="form-input" value="${f.title}" placeholder="Feature-Titel" data-feature-title="${idx}">
                            </div>
                        </div>
                        <div class="form-row full">
                            <div>
                                <label class="form-label">Beschreibung</label>
                                <textarea class="textarea" placeholder="Feature-Beschreibung" data-feature-description="${idx}">${f.description}</textarea>
                            </div>
                        </div>
                    </div>
                `).join('');

                // Pricing
                const pricingContainer = document.getElementById('contentPricingContainer');
                pricingContainer.innerHTML = (this.content.pricing || []).map((p, idx) => `
                    <div class="form-section" style="margin-bottom: 1rem;">
                        <div class="form-section-title">Preisplan ${idx + 1}</div>
                        <div class="form-row">
                            <div>
                                <label class="form-label">Label</label>
                                <input type="text" class="form-input" value="${p.label}" placeholder="Plan-Name" data-pricing-label="${idx}">
                            </div>
                            <div>
                                <label class="form-label">Auflösung</label>
                                <input type="text" class="form-input" value="${p.resolution}" placeholder="z.B. 4K" data-pricing-resolution="${idx}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div>
                                <label class="form-label">Preis</label>
                                <input type="text" class="form-input" value="${p.price}" placeholder="€ 99.99" data-pricing-price="${idx}">
                            </div>
                            <div style="display: flex; align-items: flex-end;">
                                <div class="checkbox-group">
                                    <input type="checkbox" class="checkbox" ${p.featured ? 'checked' : ''} data-pricing-featured="${idx}">
                                    <label class="form-label" style="margin-bottom: 0;">Featured</label>
                                </div>
                            </div>
                        </div>
                        <div class="form-row full">
                            <div>
                                <label class="form-label">Beschreibung</label>
                                <textarea class="textarea" placeholder="Plan-Beschreibung" data-pricing-description="${idx}">${p.description}</textarea>
                            </div>
                        </div>
                    </div>
                `).join('');

                // Nav
                document.getElementById('contentNavLinks').value = (this.content.nav?.links || []).join(', ');
                document.getElementById('contentNavCTA').value = this.content.nav?.ctaText || '';

                // Footer
                document.getElementById('contentFooterCopyright').value = this.content.footer?.copyright || '';
                document.getElementById('contentFooterColumns').value = JSON.stringify(this.content.footer?.columns || [], null, 2);

                // SEO
                document.getElementById('contentSEOTitle').value = this.content.seo?.title || '';
                document.getElementById('contentSEODescription').value = this.content.seo?.description || '';
            },

            savePageContent() {
                this.content = {
                    hero: {
                        title: document.getElementById('contentHeroTitle').value,
                        subtitle: document.getElementById('contentHeroSubtitle').value,
                        searchPlaceholder: document.getElementById('contentHeroSearchPlaceholder').value
                    },
                    features: Array.from(document.querySelectorAll('[data-feature-icon]')).map((_, idx) => ({
                        icon: document.querySelector(`[data-feature-icon="${idx}"]`).value,
                        title: document.querySelector(`[data-feature-title="${idx}"]`).value,
                        description: document.querySelector(`[data-feature-description="${idx}"]`).value
                    })),
                    pricing: Array.from(document.querySelectorAll('[data-pricing-label]')).map((_, idx) => ({
                        label: document.querySelector(`[data-pricing-label="${idx}"]`).value,
                        resolution: document.querySelector(`[data-pricing-resolution="${idx}"]`).value,
                        price: document.querySelector(`[data-pricing-price="${idx}"]`).value,
                        description: document.querySelector(`[data-pricing-description="${idx}"]`).value,
                        featured: document.querySelector(`[data-pricing-featured="${idx}"]`).checked
                    })),
                    nav: {
                        links: document.getElementById('contentNavLinks').value.split(',').map(l => l.trim()).filter(Boolean),
                        ctaText: document.getElementById('contentNavCTA').value
                    },
                    footer: {
                        copyright: document.getElementById('contentFooterCopyright').value,
                        columns: JSON.parse(document.getElementById('contentFooterColumns').value || '[]')
                    },
                    seo: {
                        title: document.getElementById('contentSEOTitle').value,
                        description: document.getElementById('contentSEODescription').value
                    }
                };

                localStorage.setItem('adminPageContent', JSON.stringify(this.content));
                localStorage.setItem('adminLastChange', new Date().toISOString());
                this.showAlert('contentAlert', 'success', 'Seiteninhalte gespeichert');
            },

            // ===== DESIGN =====
            loadDesignVariables() {
                const stored = localStorage.getItem('adminDesignVariables');
                const cssVars = [
                    'bg-primary', 'bg-secondary', 'bg-tertiary',
                    'text-primary', 'text-secondary',
                    'accent', 'accent-hover',
                    'success', 'warning', 'danger', 'border'
                ];

                this.designVariables = {};
                cssVars.forEach(v => {
                    const computedStyle = getComputedStyle(document.documentElement);
                    this.designVariables[v] = stored ?
                        JSON.parse(stored)[v] :
                        computedStyle.getPropertyValue(`--${v}`).trim();
                });

                this.renderDesignVariables();
            },

            renderDesignVariables() {
                const container = document.getElementById('designVariablesContainer');
                container.innerHTML = Object.entries(this.designVariables).map(([key, value]) => `
                    <div class="form-row" style="align-items: flex-end;">
                        <div>
                            <label class="form-label">--${key}</label>
                            <div class="color-input-group">
                                <input type="color" class="color-input design-var-${key}" value="${value}">
                                <input type="text" class="text-input-small" value="${value}" readonly data-design-var="${key}">
                            </div>
                        </div>
                    </div>
                `).join('');

                Object.keys(this.designVariables).forEach(key => {
                    const colorInput = document.querySelector(`.design-var-${key}`);
                    if (colorInput) {
                        colorInput.addEventListener('input', (e) => {
                            document.querySelector(`[data-design-var="${key}"]`).value = e.target.value;
                            document.documentElement.style.setProperty(`--${key}`, e.target.value);
                        });
                    }
                });
            },

            saveDesignVariables() {
                const vars = {};
                document.querySelectorAll('[data-design-var]').forEach(input => {
                    vars[input.dataset.designVar] = input.value;
                    document.documentElement.style.setProperty(`--${input.dataset.designVar}`, input.value);
                });

                localStorage.setItem('adminDesignVariables', JSON.stringify(vars));
                localStorage.setItem('adminLastChange', new Date().toISOString());
                this.showAlert('designAlert', 'success', 'Design-Variablen gespeichert');
            },

            importDesignCSS() {
                const cssText = document.getElementById('designImportCSS').value;
                if (!cssText) {
                    this.showAlert('designAlert', 'error', 'Bitte geben Sie CSS ein');
                    return;
                }

                try {
                    const matches = cssText.match(/--[\w-]+\s*:\s*[^;]+/g);
                    if (!matches) throw new Error('Keine CSS-Variablen gefunden');

                    const vars = {};
                    matches.forEach(match => {
                        const [key, value] = match.split(':').map(s => s.trim());
                        vars[key.replace('--', '')] = value;
                        document.documentElement.style.setProperty(key, value);
                    });

                    localStorage.setItem('adminDesignVariables', JSON.stringify(vars));
                    localStorage.setItem('adminLastChange', new Date().toISOString());
                    this.loadDesignVariables();
                    this.showAlert('designAlert', 'success', 'Design importiert');
                } catch (err) {
                    this.showAlert('designAlert', 'error', 'Fehler beim Importieren: ' + err.message);
                }
            },

            resetDesignToDefault() {
                if (confirm('Wirklich zurücksetzen?')) {
                    localStorage.removeItem('adminDesignVariables');
                    location.reload();
                }
            },

            // ===== SETTINGS =====
            loadSettings() {
                const settings = auth.loadSettings();

                document.getElementById('settings2faServiceId').value = settings.emailJS?.serviceId || '';
                document.getElementById('settings2faTemplateId').value = settings.emailJS?.templateId || '';
                document.getElementById('settings2faPublicKey').value = settings.emailJS?.publicKey || '';
                document.getElementById('settings2faEmail').value = settings.adminEmail || '';

                document.getElementById('settingsGitHubToken').value = settings.gitHub?.token || '';
                document.getElementById('settingsGitHubRepo').value = settings.gitHub?.repo || 'y4wmmzqcjc-dotcom/stockvideo-de';
                document.getElementById('settingsGitHubBranch').value = settings.gitHub?.branch || 'main';
            },

            changePassword() {
                const newPassword = document.getElementById('settingsNewPassword').value;
                const confirmPassword = document.getElementById('settingsConfirmPassword').value;

                if (!newPassword) {
                    this.showAlert('settingsAlert', 'error', 'Bitte geben Sie ein neues Passwort ein');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    this.showAlert('settingsAlert', 'error', 'Passwörter stimmen nicht überein');
                    return;
                }

                const hash = CryptoJS.SHA256(newPassword).toString();
                localStorage.setItem('adminPasswordHash', hash);

                document.getElementById('settingsNewPassword').value = '';
                document.getElementById('settingsConfirmPassword').value = '';

                this.showAlert('settingsAlert', 'success', 'Passwort geändert');
            },

            save2FASettings() {
                const settings = auth.loadSettings();
                settings.emailJS = {
                    serviceId: document.getElementById('settings2faServiceId').value,
                    templateId: document.getElementById('settings2faTemplateId').value,
                    publicKey: document.getElementById('settings2faPublicKey').value
                };
                settings.adminEmail = document.getElementById('settings2faEmail').value;

                localStorage.setItem('adminSettings', JSON.stringify(settings));
                this.showAlert('settingsAlert', 'success', '2FA-Einstellungen gespeichert');
            },

            saveGitHubSettings() {
                const settings = auth.loadSettings();
                settings.gitHub = {
                    token: document.getElementById('settingsGitHubToken').value,
                    repo: document.getElementById('settingsGitHubRepo').value,
                    branch: document.getElementById('settingsGitHubBranch').value
                };

                localStorage.setItem('adminSettings', JSON.stringify(settings));
                this.showAlert('settingsAlert', 'success', 'GitHub-Einstellungen gespeichert');
            },

            // ===== GITHUB PUBLISH =====
            publishToGitHub() {
                const settings = auth.loadSettings();
                if (!settings.gitHub.token) {
                    this.showAlert('dashboardAlert', 'error', 'GitHub ist nicht konfiguriert');
                    return;
                }

                const button = event.target;
                button.disabled = true;
                button.textContent = 'Veröffentlichung...';

                const config = {
                    videos: this.videos,
                    categories: this.categories,
                    pageContent: this.content
                };

                this.createGitHubCommit(settings, config)
                    .then(() => {
                        this.showAlert('dashboardAlert', 'success', 'Erfolgreich veröffentlicht! Cloudflare Pages wird neu gebaut...');
                        setTimeout(() => {
                            this.refreshDeployStatus();
                        }, 3000);
                    })
                    .catch(err => {
                        console.error('Publish Error:', err);
                        this.showAlert('dashboardAlert', 'error', 'Fehler beim Veröffentlichen: ' + err.message);
                    })
                    .finally(() => {
                        button.disabled = false;
                        button.textContent = 'Veröffentlichen';
                    });
            },

            async createGitHubCommit(settings, config) {
                const { token, repo, branch } = settings.gitHub;
                const headers = {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                };

                // Get current HEAD
                const headRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, { headers });
                if (!headRes.ok) throw new Error('Fehler beim Abrufen der Branch');
                const headData = await headRes.json();
                const headSha = headData.object.sha;

                // Get commit tree
                const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${headSha}`, { headers });
                if (!commitRes.ok) throw new Error('Fehler beim Abrufen des Commits');
                const commitData = await commitRes.json();
                const baseSha = commitData.tree.sha;

                // Create new tree
                const timestamp = new Date().toISOString();
                const treeData = {
                    base_tree: baseSha,
                    tree: [
                        {
                            path: 'public/data/videos.json',
                            mode: '100644',
                            type: 'blob',
                            content: JSON.stringify(config.videos, null, 2)
                        },
                        {
                            path: 'public/data/categories.json',
                            mode: '100644',
                            type: 'blob',
                            content: JSON.stringify(config.categories, null, 2)
                        },
                        {
                            path: 'public/data/config.json',
                            mode: '100644',
                            type: 'blob',
                            content: JSON.stringify(config.pageContent, null, 2)
                        }
                    ]
                };

                const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(treeData)
                });

                if (!treeRes.ok) throw new Error('Fehler beim Erstellen des Baums');
                const treeResult = await treeRes.json();

                // Create commit
                const commitData2 = {
                    message: `Admin: Update content (${timestamp})`,
                    tree: treeResult.sha,
                    parents: [headSha]
                };

                const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(commitData2)
                });

                if (!newCommitRes.ok) throw new Error('Fehler beim Erstellen des Commits');
                const newCommit = await newCommitRes.json();

                // Update branch reference
                const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ sha: newCommit.sha })
                });

                if (!refRes.ok) throw new Error('Fehler beim Aktualisieren der Branch');

                localStorage.setItem('adminLastChange', new Date().toISOString());
            },

            // ===== HELPERS =====
            showAlert(elementId, type, message) {
                const element = document.getElementById(elementId);
                const className = `alert alert-${type}`;
                element.innerHTML = `<div class="${className}">${message}</div>`;
                setTimeout(() => {
                    element.innerHTML = '';
                }, 5000);
            },

            exportAllData() {
                const data = {
                    videos: this.videos,
                    categories: this.categories,
                    pageContent: this.content,
                    timestamp: new Date().toISOString()
                };

                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `stockvideo-admin-export-${Date.now()}.json`;
                a.click();
            },

            importAllData() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const data = JSON.parse(event.target.result);
                            localStorage.setItem('adminVideos', JSON.stringify(data.videos));
                            localStorage.setItem('adminCategories', JSON.stringify(data.categories));
                            localStorage.setItem('adminPageContent', JSON.stringify(data.pageContent));
                            location.reload();
                        } catch (err) {
                            this.showAlert('settingsAlert', 'error', 'Fehler beim Importieren');
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            }
        };

        // Initialize on page load
        window.addEventListener('load', () => {
            const isAuthenticated = localStorage.getItem('adminAuthenticated');
            if (isAuthenticated === 'true') {
                document.getElementById('authScreen').style.display = 'none';
                document.getElementById('adminLayout').style.display = 'flex';
                admin.init();
            } else {
                auth.init();
            }
        });
    

// ========== WORKER-BACKED PUBLISH + AUTO-BOOTSTRAP ==========
(function(){
  var ensure=function(){
    if(typeof window.admin==="undefined"){setTimeout(ensure,50);return;}
    window.admin.publishToGitHub=async function(){
      try{
        var pw=prompt("Admin-Passwort zum Veroeffentlichen:","admin123");
        if(!pw)return;
        var videos=JSON.parse(localStorage.getItem("adminVideos")||"[]");
        var cats=JSON.parse(localStorage.getItem("adminCategories")||"[]");
        var hdr={"Content-Type":"application/json","X-Admin-Password":pw};
        var r1=await fetch("/admin/data",{method:"POST",headers:hdr,body:JSON.stringify({kind:"videos",items:videos})});
        var j1=await r1.json();
        if(!r1.ok){alert("Videos Fehler: "+(j1.error||r1.status));return;}
        var r2=await fetch("/admin/data",{method:"POST",headers:hdr,body:JSON.stringify({kind:"categories",items:cats})});
        var j2=await r2.json();
        if(!r2.ok){alert("Categories Fehler: "+(j2.error||r2.status));return;}
        alert("Veroeffentlicht! Cloudflare Pages rebuildet in ~60s.");
      }catch(e){alert("Fehler: "+e.message);}
    };
  };
  ensure();
})();
// AUTO_BOOTSTRAP_DATA
(function(){try{var v=JSON.parse(localStorage.getItem("adminVideos")||"[]");var c=JSON.parse(localStorage.getItem("adminCategories")||"[]");if(v.length>0&&c.length>0)return;Promise.all([fetch("/data/videos.json").then(r=>r.ok?r.json():[]).catch(()=>[]),fetch("/data/categories.json").then(r=>r.ok?r.json():[]).catch(()=>[])]).then(function(a){if(a[0]&&a[0].length)localStorage.setItem("adminVideos",JSON.stringify(a[0]));if(a[1]&&a[1].length)localStorage.setItem("adminCategories",JSON.stringify(a[1]));try{window.admin&&window.admin.loadVideos&&window.admin.loadVideos();window.admin&&window.admin.loadCategories&&window.admin.loadCategories();}catch(e){}});}catch(e){}})();

;(function(){var tries=0;function go(){tries++;if(window.admin&&typeof window.admin.showSection==="function"){try{window.admin.loadDashboard&&window.admin.loadDashboard()}catch(e){}try{window.admin.showSection("dashboard")}catch(e){}return;}if(tries<40)setTimeout(go,200);}setTimeout(go,800)})();/*BOOTSTRAP_RERENDER*/
