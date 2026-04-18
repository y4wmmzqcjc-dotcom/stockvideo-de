

// ===== MEDIENDATENBANK MODULE =====
var mediaModule = {
    items: [],
    selectedIds: new Set(),
    activeId: null,
    currentFilter: 'alle',
    r2Base: 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev',

    _articleDataLoaded: false,

    init() {
        this.loadItems();
        // Also load real article images from articles.json
        this.loadFromArticles();
    },

    loadItems() {
        const stored = localStorage.getItem('mediaItems_v2');
        if (stored) {
            try { this.items = JSON.parse(stored); if (this.items.length > 5) return; } catch(e) {}
        }
        // Empty until articles data loads
        this.items = [];
    },

    loadFromArticles() {
        var self = this;
        fetch('/data/articles.json?_=' + Date.now())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var articles = Array.isArray(data) ? data : (data.articles || []);
                var imageMap = new Map();
                var idCounter = 1;

                articles.forEach(function(a) {
                    // Hero images
                    if (a.heroImage) {
                        var fn = a.heroImage.split('/').pop();
                        if (!imageMap.has(fn)) {
                            imageMap.set(fn, {
                                id: idCounter++,
                                name: fn,
                                url: a.heroImage,
                                alt: a.title || fn,
                                category: 'hero',
                                size: '~2 MB',
                                dims: '1920x1280',
                                date: '2026-03-01',
                                usedIn: [a.title]
                            });
                        } else {
                            var existing = imageMap.get(fn);
                            if (existing.usedIn.indexOf(a.title) === -1) existing.usedIn.push(a.title);
                        }
                    }
                    // Inline images
                    if (a.inlineImages && a.inlineImages.length > 0) {
                        a.inlineImages.forEach(function(img) {
                            var fn = img.split('/').pop();
                            var fullUrl = img.startsWith('/') ? img : '/images/making-of/' + img;
                            if (!imageMap.has(fn)) {
                                imageMap.set(fn, {
                                    id: idCounter++,
                                    name: fn,
                                    url: fullUrl,
                                    alt: a.title || fn,
                                    category: 'artikel',
                                    size: '~1.5 MB',
                                    dims: '1920x1280',
                                    date: '2026-03-01',
                                    usedIn: [a.title]
                                });
                            } else {
                                var existing = imageMap.get(fn);
                                if (existing.usedIn.indexOf(a.title) === -1) existing.usedIn.push(a.title);
                                // If used as both hero and inline, mark as hero
                            }
                        });
                    }
                });

                self.items = Array.from(imageMap.values());
                self._articleDataLoaded = true;
                self.saveItems();
                self.render();
            })
            .catch(function(err) {
                console.warn('Mediendatenbank: Konnte Artikeldaten nicht laden', err);
                // Keep whatever was loaded from localStorage or empty
                if (self.items.length === 0) self.render();
            });
    },

    saveItems() {
        try { localStorage.setItem('mediaItems_v2', JSON.stringify(this.items)); } catch(e) {}
    },

    render() {
        this.loadItems();
        const grid = document.getElementById('media-grid');
        if (!grid) return;

        let filtered = this.items;
        const search = ((document.getElementById('media-search') ? document.getElementById('media-search').value : '') || '').toLowerCase();

        if (this.currentFilter !== 'alle') {
            if (this.currentFilter === 'unbenutzt') {
                filtered = filtered.filter(m => !m.usedIn || m.usedIn.length === 0);
            } else {
                filtered = filtered.filter(m => m.category === this.currentFilter);
            }
        }
        if (search) {
            filtered = filtered.filter(m => m.name.toLowerCase().includes(search) || m.alt.toLowerCase().includes(search));
        }

        grid.innerHTML = filtered.map(item => 
            '<div class="media-card' + (this.selectedIds.has(item.id) ? ' selected' : '') + '" ' +
            'onclick="mediaModule.handleClick(event,' + item.id + ')" ondblclick="mediaModule.openDetail(' + item.id + ')">' +
            '<div class="media-card-check" onclick="event.stopPropagation();mediaModule.toggleSelect(' + item.id + ')">' +
            (this.selectedIds.has(item.id) ? '\u2713' : '') + '</div>' +
            '<div class="media-card-thumb"><img src="' + item.url + '" alt="' + (item.alt||item.name) + '" loading="lazy" ' +
            'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'+
            '<div class="media-placeholder" style="display:none;align-items:center;justify-content:center;flex-direction:column;gap:6px;width:100%;height:100%;background:linear-gradient(135deg,#1a1a2e,#2a2a4e);color:#8888aa;font-size:11px;text-align:center;padding:8px"><span style="font-size:24px;opacity:0.5">🖼</span><span style="word-break:break-all;line-height:1.3">' + (item.name||'Bild') + '</span></div></div>' +
            '<div class="media-card-info"><div class="media-card-name">' + item.name + '</div>' +
            '<div class="media-card-meta"><span>' + item.size + '</span><span>' +
            (item.usedIn && item.usedIn.length > 0 ? '\u2713 Verwendet' : 'Frei') + '</span></div></div></div>'
        ).join('');

        // Stats
        document.getElementById('media-total-count').textContent = this.items.length;
        const used = this.items.filter(m => m.usedIn && m.usedIn.length > 0).length;
        document.getElementById('media-used-count').textContent = used;
        document.getElementById('media-unused-count').textContent = this.items.length - used;

        // Bulk bar
        const bar = document.getElementById('media-bulk-bar');
        if (this.selectedIds.size > 0) {
            bar.style.display = 'flex';
            document.getElementById('media-selected-count').textContent = this.selectedIds.size + ' ausgewählt';
        } else {
            bar.style.display = 'none';
        }
    },

    handleClick(event, id) {
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            this.toggleSelect(id);
        } else {
            this.openDetail(id);
        }
    },

    toggleSelect(id) {
        if (this.selectedIds.has(id)) this.selectedIds.delete(id); else this.selectedIds.add(id);
        this.render();
    },

    deselectAll() {
        this.selectedIds.clear();
        this.render();
    },

    filter() { this.render(); },

    setFilter(type, el) {
        this.currentFilter = type;
        document.querySelectorAll('.media-pill').forEach(p => p.classList.remove('active'));
        if (el) el.classList.add('active');
        this.render();
    },

    openDetail(id) {
        this.activeId = id;
        const item = this.items.find(m => m.id === id);
        if (!item) return;

        document.getElementById('media-detail-preview').innerHTML =
            '<img src="' + item.url + '" alt="' + item.alt + '" onerror="this.parentElement.innerHTML=\'<div style=font-size:40px;color:#666>\ud83d\udcf7</div>\'"></' + 'img>';
        document.getElementById('media-detail-name').value = item.name;
        document.getElementById('media-detail-alt').value = item.alt;
        document.getElementById('media-detail-category').value = item.category || '';
        document.getElementById('media-detail-size').textContent = item.size;
        document.getElementById('media-detail-dims').textContent = item.dims;
        document.getElementById('media-detail-date').textContent = item.date;

        const usageEl = document.getElementById('media-detail-usage');
        if (item.usedIn && item.usedIn.length > 0) {
            usageEl.innerHTML = item.usedIn.map(a => '<div style="padding:4px 0;border-bottom:1px solid #333;">\ud83d\udcc4 ' + a + '</div>').join('');
        } else {
            usageEl.innerHTML = '<span style="color:#666;">Nicht in Verwendung</span>';
        }

        const sidebar = document.getElementById('media-detail-sidebar'); sidebar.style.display = 'block'; setTimeout(() => sidebar.classList.add('active'), 10);
    },

    closeDetail() {
        const sb = document.getElementById('media-detail-sidebar'); sb.classList.remove('active'); setTimeout(() => { if (!sb.classList.contains('active')) sb.style.display = 'none'; }, 350);
        this.activeId = null;
    },

    saveDetail() {
        if (!this.activeId) return;
        const item = this.items.find(m => m.id === this.activeId);
        if (!item) return;
        item.name = document.getElementById('media-detail-name').value;
        item.alt = document.getElementById('media-detail-alt').value;
        item.category = document.getElementById('media-detail-category').value;
        this.saveItems();
        this.render();
        admin.showAlert('mediaAlert', 'Bilddetails gespeichert', 'success');
    },

    copyUrl() {
        if (!this.activeId) return;
        const item = this.items.find(m => m.id === this.activeId);
        if (!item) return;
        navigator.clipboard.writeText(item.url).then(() => {
            admin.showAlert('mediaAlert', 'URL kopiert', 'success');
        });
    },

    replace(files) {
        if (!files || !files[0] || !this.activeId) return;
        const file = files[0];
        const item = this.items.find(m => m.id === this.activeId);
        if (!item) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            item.url = e.target.result;
            item.name = file.name;
            item.size = this.formatSize(file.size);
            item.date = new Date().toISOString().split('T')[0];
            const img = new Image();
            img.onload = () => {
                item.dims = img.width + 'x' + img.height;
                this.saveItems();
                this.openDetail(this.activeId);
                this.render();
                admin.showAlert('mediaAlert', 'Bild ersetzt', 'success');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    deleteActive() {
        if (!this.activeId) return;
        this.items = this.items.filter(m => m.id !== this.activeId);
        this.saveItems();
        this.closeDetail();
        this.render();
        admin.showAlert('mediaAlert', 'Bild gelöscht', 'success');
    },

    bulkDelete() {
        const count = this.selectedIds.size;
        this.items = this.items.filter(m => !this.selectedIds.has(m.id));
        this.selectedIds.clear();
        this.saveItems();
        this.render();
        admin.showAlert('mediaAlert', count + ' Bilder gelöscht', 'success');
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    upload(files) {
        if (!files || files.length === 0) return;
        let uploaded = 0;
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const newId = Math.max(...this.items.map(m => m.id), 0) + 1;
                    this.items.unshift({
                        id: newId, name: file.name, url: e.target.result,
                        alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
                        category: '', size: this.formatSize(file.size),
                        dims: img.width + 'x' + img.height,
                        date: new Date().toISOString().split('T')[0], usedIn: []
                    });
                    uploaded++;
                    if (uploaded === imageFiles.length) {
                        this.saveItems();
                        this.render();
                        admin.showAlert('mediaAlert', uploaded + ' Bild(er) hochgeladen', 'success');
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
    dragLeave(e) { e.currentTarget.classList.remove('drag-over'); },
    drop(e) { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); this.upload(e.dataTransfer.files); }
};

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
                const alertEl = document.getElementById('passwordAlert');

                if (!password) {
                    if (alertEl) alertEl.innerHTML = '<div class="alert alert-error">Bitte geben Sie ein Passwort ein</div>';
                    return;
                }

                try {
                    const hash = CryptoJS.SHA256(password).toString();
                    const correctHash = localStorage.getItem('adminPasswordHash');

                    if (hash === correctHash) {
                        if (alertEl) alertEl.innerHTML = '';
                        this.startOTPProcess();
                    } else {
                        if (alertEl) alertEl.innerHTML = '<div class="alert alert-error">Falsches Passwort</div>';
                    }
                } catch(e) {
                    if (alertEl) alertEl.innerHTML = '<div class="alert alert-error">Fehler: ' + e.message + '</div>';
                    console.error('verifyPassword error:', e);
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
                    // EmailJS not loaded \u2013 show OTP in console for dev/testing
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
                const panelMap = ['dashboard','videos','categories','content','articles','design','settings'];
      document.querySelectorAll('.nav-item').forEach((item, idx) => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          const panelName = panelMap[idx];
          if (panelName) {
            document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
            const target = document.getElementById('panel-' + panelName);
            if (target) target.classList.add('active');
          }
        });
      });            },

            switchPanel(panel) {
                document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${panel}`).classList.add('active');

                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                event.target.closest('.nav-item').classList.add('active');

            // Auto-render calendar and media panels
            if (panel === 'calendar' && typeof calendarModule !== 'undefined') calendarModule.render();
            if (panel === 'media' && typeof mediaModule !== 'undefined') mediaModule.render();
                if (panel === 'calendar') calendarModule.render();
                if (panel === 'media') mediaModule.render();
            },

            // ===== DASHBOARD =====
        updateDashboard() {
      this.loadVideos();
      this.loadCategories();
      const vCount = this.videos.length;
      const cCount = this.categories.length;
      const articles = JSON.parse(localStorage.getItem('adminArticles') || '[]');
      const aCount = articles.length;
      const mediaItems = JSON.parse(localStorage.getItem('mediaItems') || '[]');
      const mCount = mediaItems.length;
      // R2 storage calc
      const r2UsedMB = mediaItems.reduce((sum, m) => sum + (m.size || 0), 0) / (1024*1024);
      const r2FreeMB = 10240; // 10 GB free
      const r2Pct = Math.min(100, (r2UsedMB / r2FreeMB * 100));
      const r2Color = r2Pct > 90 ? '#ff3b30' : r2Pct > 70 ? '#ff9500' : '#34c759';
      const overageMB = Math.max(0, r2UsedMB - r2FreeMB);
      const overageCost = (overageMB / 1024 * 0.015).toFixed(4);
      const lastDeploy = localStorage.getItem('lastDeployTime') || 'Unbekannt';

      const dc = document.getElementById('dashboardContent');
      if (!dc) return;
      dc.innerHTML = '<div style="padding:24px;max-width:1100px">' +
        '<h2 style="margin:0 0 20px;color:#fff;font-size:22px">Dashboard</h2>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">' +
          '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;text-align:center">' +
            '<div style="font-size:32px;font-weight:700;color:#0099ff">' + vCount + '</div>' +
            '<div style="color:#888;font-size:13px;margin-top:4px">Videos</div></div>' +
          '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;text-align:center">' +
            '<div style="font-size:32px;font-weight:700;color:#34c759">' + cCount + '</div>' +
            '<div style="color:#888;font-size:13px;margin-top:4px">Kategorien</div></div>' +
          '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;text-align:center">' +
            '<div style="font-size:32px;font-weight:700;color:#ff9500">' + aCount + '</div>' +
            '<div style="color:#888;font-size:13px;margin-top:4px">Artikel</div></div>' +
          '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;text-align:center">' +
            '<div style="font-size:32px;font-weight:700;color:#af52de">' + mCount + '</div>' +
            '<div style="color:#888;font-size:13px;margin-top:4px">Medien</div></div>' +
        '</div>' +
        '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px">' +
          '<h3 style="margin:0 0 12px;color:#fff;font-size:16px">R2 Speicher</h3>' +
          '<div style="background:#0d0d1a;border-radius:8px;height:24px;overflow:hidden;margin-bottom:8px">' +
            '<div style="height:100%;width:' + r2Pct + '%;background:' + r2Color + ';border-radius:8px;transition:width 0.5s"></div></div>' +
          '<div style="display:flex;justify-content:space-between;color:#888;font-size:13px">' +
            '<span>' + r2UsedMB.toFixed(1) + ' MB belegt</span>' +
            '<span>' + (r2FreeMB/1024).toFixed(0) + ' GB frei (Cloudflare R2)</span></div>' +
          '<div style="margin-top:12px;padding:12px;background:#0d0d1a;border-radius:8px;font-size:13px;color:#888">' +
            '<strong style="color:#fff">Kostenkalkulator:</strong> 10 GB kostenlos. Danach $0.015/GB/Monat.' +
            (overageMB > 0 ? ' <span style="color:#ff9500">Aktuell: $' + overageCost + '/Monat Mehrkosten</span>' : ' <span style="color:#34c759">Aktuell im Free Tier</span>') +
          '</div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
          '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px">' +
            '<h3 style="margin:0 0 8px;color:#fff;font-size:16px">Status</h3>' +
            '<div style="color:#888;font-size:13px">Letztes Deploy: ' + lastDeploy + '</div></div>' +
          '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px">' +
            '<h3 style="margin:0 0 8px;color:#fff;font-size:16px">Letzte Artikel</h3>' +
            '<div style="color:#888;font-size:13px">' +
            (articles.length > 0 ? articles.slice(0,3).map(function(a){return '<div style="margin-bottom:4px">' + (a.title||'Ohne Titel') + '</div>';}).join('') : 'Keine Artikel') +
          '</div></div></div></div>';
      this.refreshDeployStatus();
    },

    refreshDeployStatus() {
                const settings = auth.loadSettings();
                if (!settings.gitHub.token) {
                    document.getElementById('statDeployStatus').textContent = '\u26a0\ufe0f';
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
                        document.getElementById('statDeployStatus').textContent = '\u2705';
                        const date = new Date(data.commit.author.date);
                        document.getElementById('statDeployTime').textContent = date.toLocaleTimeString('de-DE');
                    } else {
                        throw new Error('No commit data');
                    }
                })
                .catch(err => {
                    console.error('GitHub Error:', err);
                    document.getElementById('statDeployStatus').textContent = '\u274c';
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
      const searchTerm = (this._videoSearch || '').toLowerCase();
      const filtered = searchTerm ? this.videos.filter(function(v) {
        return (v.title||'').toLowerCase().includes(searchTerm) || (v.category||'').toLowerCase().includes(searchTerm);
      }) : this.videos;

      if (this.videos.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#888"><p>Keine Videos vorhanden</p></div>';
        return;
      }

      // Only rebuild search bar if it doesn't exist yet
      let searchBar = document.getElementById('videoSearchBar');
      if (!searchBar) {
        const barHtml = '<div id="videoSearchBar" style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:12px">' +
          '<input type="text" id="videoSearchInput" placeholder="Videos durchsuchen..." ' +
          'style="flex:1;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;font-size:14px;outline:none">' +
          '<span id="videoSearchCount" style="color:#888;font-size:13px;white-space:nowrap"></span></div>' +
          '<div id="videoListItems"></div>';
        container.innerHTML = barHtml;
        document.getElementById('videoSearchInput').addEventListener('input', function(e) {
          admin._videoSearch = e.target.value;
          admin.renderVideosList();
        });
      }

      // Update count
      var countEl = document.getElementById('videoSearchCount');
      if (countEl) countEl.textContent = filtered.length + ' von ' + this.videos.length + ' Videos';

      // Only rebuild the items list
      var listEl = document.getElementById('videoListItems') || container;
      listEl.innerHTML = filtered.map(function(v, i) {
        var origIdx = admin.videos.indexOf(v);
        var thumbUrl = v.thumbnail || v.posterUrl || '';
        return '<div class="video-item" style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer" onclick="admin.editVideo(' + origIdx + ')">' +
          '<div style="width:80px;height:45px;border-radius:6px;overflow:hidden;background:#1a1a2e;margin-right:12px;flex-shrink:0">' +
          (thumbUrl ? '<img src="' + thumbUrl + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : '') +
          '</div>' +
          '<div style="flex:1;min-width:0"><div style="color:#fff;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (v.title||'Ohne Titel') + '</div>' +
          '<div style="color:#888;font-size:12px;margin-top:2px">' + (v.category||'Keine Kategorie') + '</div></div>' +
          '<button onclick="event.stopPropagation();admin.editVideo(' + origIdx + ')" style="background:rgba(255,255,255,0.07);color:#ccc;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;margin-right:6px">Bearbeiten</button>' +
                '<button onclick="event.stopPropagation();admin.deleteVideo(' + origIdx + ')" style="background:rgba(255,59,48,0.1);color:#ff3b30;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px">Löschen</button>' +
          '</div>';
      }).join('');
    },

    async syncFromLive() {
          try {
            const [cr, vr] = await Promise.all([
              fetch('/data/categories.json?_='+Date.now(), { cache: 'no-store' }),
              fetch('/data/videos.json?_='+Date.now(), { cache: 'no-store' })
            ]);
            if (cr.ok) {
              const cats = await cr.json();
              if (Array.isArray(cats) && cats.length > this.categories.length) {
                this.categories = cats;
                if (this.renderCategories) this.renderCategories();
              }
            }
            if (vr.ok) {
              const vids = await vr.json();
              if (Array.isArray(vids) && vids.length > this.videos.length) {
                this.videos = vids;
                if (this.renderVideos) this.renderVideos();
              }
            }
          } catch(e) { console.warn('syncFromLive failed', e); }
        },
        openVideoModal() {
                this.editingVideoId = null;
                document.getElementById('videoModalTitle').textContent = 'Neues Video';
                document.getElementById('videoModalTitle_Input').value = '';
                document.getElementById('videoModalSlug').value = '';
        var _pkn=document.getElementById('videoModalPreviewKey'); if(_pkn) _pkn.value='';
        var _hkn=document.getElementById('videoModalHoverKey'); if(_hkn) _hkn.value='';
        var _vidn=document.getElementById('videoModalVideoId'); if(_vidn) _vidn.value='';
                document.getElementById('videoModalDescription').value = '';
                document.getElementById('videoModalCategory').value = '';
                document.getElementById('videoModalTags').value = '';
                document.getElementById('videoModalResolution').value = '4K';
                document.getElementById('videoModalDuration').value = '';
                document.getElementById('videoModalFPS').value = '';
                document.getElementById('videoModalPrice').value = '';
                document.getElementById('videoModalPrice').value = '';
                document.getElementById('videoModalPrice').value = '';
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
                document.getElementById('videoModalPrice').value = video.prices.web;
                document.getElementById('videoModalPrice').value = video.prices.standard;
                document.getElementById('videoModalPrice').value = video.prices.premium;
                document.getElementById('videoModalThumbnail').value = video.thumbnail;
                document.getElementById('videoModalR2Key').value = video.r2Key;
        var _pk=document.getElementById('videoModalPreviewKey'); if(_pk) _pk.value=video.r2Preview||'';
        var _hk=document.getElementById('videoModalHoverKey'); if(_hk) _hk.value=video.r2Hover||'';
        var _vid=document.getElementById('videoModalVideoId'); if(_vid) _vid.value=video.videoId||'';
                document.getElementById('videoModalFeatured').checked = video.featured;

                this.updateCategoryDropdown();
                const _setCat=()=>{const _d=document.getElementById('videoModalCategory');if(_d&&[..._d.options].some(o=>o.value===video.category)){_d.value=video.category;}else{setTimeout(_setCat,50);}};_setCat();
                this.renderGradientInputs(video.gradient);

                document.getElementById('videoModal').classList.add('active');
            },

            closeVideoModal() {
                document.getElementById('videoModal').classList.remove('active');
                this.editingVideoId = null;
            },

            updateCategoryDropdown() {
                const dropdown = document.getElementById('videoModalCategory');
                if (!dropdown) return;
                fetch('/data/categories.json?_=' + Date.now(), { cache: 'no-store' })
                    .then(r => r.ok ? r.json() : [])
                    .catch(() => [])
                    .then(list => {
                        const cats = (Array.isArray(list) && list.length) ? list : (this.categories || []);
                        dropdown.innerHTML = '<option value="">-- Wählen Sie eine Kategorie --</option>' +
                            cats.map(c => '<option value="' + (c.slug || c.id) + '">' + (c.label || c.name || c.slug) + '</option>').join('');
                        if (this.currentVideo && this.currentVideo.category) dropdown.value = this.currentVideo.category;
                    });
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
                    color: row.querySelector(`.gradient-color-${idx}`) ? document.getElementById(`gradient-color-${idx}`).value : '#1473e6',
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
                        web: parseFloat(document.getElementById('videoModalPrice').value) || 0,
                        standard: parseFloat(document.getElementById('videoModalPrice').value) || 0,
                        premium: parseFloat(document.getElementById('videoModalPrice').value) || 0
                    },
                    thumbnail: document.getElementById('videoModalThumbnail').value,
                    r2Key: document.getElementById('videoModalR2Key').value,
        r2Preview: (document.getElementById('videoModalPreviewKey') && document.getElementById('videoModalPreviewKey').value) || (this.editingVideoId !== null && this.videos[this.editingVideoId] && this.videos[this.editingVideoId].r2Preview) || '',
        r2Hover: (document.getElementById('videoModalHoverKey') && document.getElementById('videoModalHoverKey').value) || (this.editingVideoId !== null && this.videos[this.editingVideoId] && this.videos[this.editingVideoId].r2Hover) || '',
        videoId: (document.getElementById('videoModalVideoId') && document.getElementById('videoModalVideoId').value) || (this.editingVideoId !== null && this.videos[this.editingVideoId] && this.videos[this.editingVideoId].videoId) || '',
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

            async deleteVideo(idx) {
                if (!confirm('Wirklich löschen?')) return;
                const video = this.videos[idx];
                const slug = video.slug;
                const r2Key = video.r2Key || null;
                this.videos.splice(idx, 1);
                localStorage.setItem('adminVideos', JSON.stringify(this.videos));
                localStorage.setItem('adminLastChange', new Date().toISOString());
                this.loadVideos();
                this.showAlert('videosAlert', 'info', 'Lösche Video...');
                try {
                    const dataRes = await fetch('https://stockvideo-checkout.rende.workers.dev/admin/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': 'admin123' },
                        body: JSON.stringify({ kind: 'videos', items: this.videos })
                    });
                    if (!dataRes.ok) throw new Error('Commit fehlgeschlagen (' + dataRes.status + ')');
                    try {
                        await fetch('https://stockvideo-checkout.rende.workers.dev/admin/delete-video', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': 'admin123' },
                          body: JSON.stringify({ slug, r2Key })
                        });
                    } catch(e2) { /* R2-Fehler nicht fatal */ }
                    this.showAlert('videosAlert', 'success', 'Video gelöscht und veröffentlicht!');
                } catch(e) {
                    this.showAlert('videosAlert', 'error', 'Fehler: ' + e.message);
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
                    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">=</div><div class="empty-state-title">Keine Kategorien</div><p>Erstellen Sie Ihre erste Kategorie</p></div>';
                    return;
                }

                container.innerHTML = this.categories.map((cat, idx) => `
                    <div class="list-item">
                        <div style="font-size: 2rem; margin-right: 1rem;">${cat.icon || '\u{1F4C1}'}</div>
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
                // Auto-publish categories to GitHub
                fetch('https://stockvideo-checkout.rende.workers.dev/admin/data', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json','X-Admin-Password':'admin123'},
                    body: JSON.stringify({kind:'categories', items:this.categories})
                }).then(r => {
                    if (r.ok) this.showAlert('categoriesAlert', 'success', 'Kategorie gespeichert und verÃ¶ffentlicht!');
                }).catch(()=>{});
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
                        { icon: '<', title: '', description: '' },
                        { icon: '=', title: '', description: '' },
                        { icon: '\u26a1', title: '', description: '' },
                        { icon: '=', title: '', description: '' }
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
                document.getElementById('contentHeroTitle').value = (this.content.hero && this.content.hero.title) || '';
                document.getElementById('contentHeroSubtitle').value = (this.content.hero && this.content.hero.subtitle) || '';
                document.getElementById('contentHeroSearchPlaceholder').value = (this.content.hero && this.content.hero.searchPlaceholder) || '';

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
                                <input type="text" class="form-input" value="${p.price}" placeholder="\u20ac 99.99" data-pricing-price="${idx}">
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
                document.getElementById('contentNavLinks').value = ((this.content.nav && this.content.nav.links) || []).join(', ');
                document.getElementById('contentNavCTA').value = (this.content.nav && this.content.nav.ctaText) || '';

                // Footer
                document.getElementById('contentFooterCopyright').value = (this.content.footer && this.content.footer.copyright) || '';
                document.getElementById('contentFooterColumns').value = JSON.stringify((this.content.footer && this.content.footer.columns) || [], null, 2);

                // SEO
                document.getElementById('contentSEOTitle').value = (this.content.seo && this.content.seo.title) || '';
                document.getElementById('contentSEODescription').value = (this.content.seo && this.content.seo.description) || '';
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

                document.getElementById('settings2faServiceId').value = settings.emailJS.serviceId || '';
                document.getElementById('settings2faTemplateId').value = settings.emailJS.templateId || '';
                document.getElementById('settings2faPublicKey').value = settings.emailJS.publicKey || '';
                document.getElementById('settings2faEmail').value = settings.adminEmail || '';

                document.getElementById('settingsGitHubToken').value = settings.gitHub.token || '';
                document.getElementById('settingsGitHubRepo').value = settings.gitHub.repo || 'y4wmmzqcjc-dotcom/stockvideo-de';
                document.getElementById('settingsGitHubBranch').value = settings.gitHub.branch || 'main';
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
                        { path: 'src/data/videos.json', mode: '100644', type: 'blob', content: JSON.stringify((config.videos||[]), null, 2) },
            {
                            path: 'public/data/categories.json',
                            mode: '100644',
                            type: 'blob',
                            content: JSON.stringify(config.categories, null, 2)
                        },
                        { path: 'src/data/categories.json', mode: '100644', type: 'blob', content: JSON.stringify((config.categories||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(c=>({slug:c.slug,label:c.label,dataCat:c.slug})), null, 2) },
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
                calendarModule.init();
                mediaModule.init();
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
        var r1=await fetch("https://stockvideo-checkout.rende.workers.dev/admin/data",{method:"POST",headers:hdr,body:JSON.stringify({kind:"videos",items:videos})});
        var j1=await r1.json();
        if(!r1.ok){alert("Videos Fehler: "+(j1.error||r1.status));return;}
        var r2=await fetch("https://stockvideo-checkout.rende.workers.dev/admin/data",{method:"POST",headers:hdr,body:JSON.stringify({kind:"categories",items:cats})});
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

;(function(){function tryRender(n){if(window.admin&&typeof window.admin.updateDashboard==="function"){try{window.admin.updateDashboard()}catch(e){}}if(n>0)setTimeout(function(){tryRender(n-1)},500)}setTimeout(function(){tryRender(20)},500)})();/*ROBUST_RERENDER*/

if (typeof admin !== "undefined" && admin.syncFromLive) { setTimeout(()=>admin.syncFromLive(), 500); }


// ===== REDAKTIONSKALENDER MODULE =====
var calendarModule = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    articles: [],

    init() {
        this.loadArticles();
    },

    loadArticles() {
        // Load from admin.articles data (article editor's data)
        try {
            const stored = localStorage.getItem('adminArticles');
            if (stored) {
                this.articles = JSON.parse(stored);
            }
        } catch(e) {}
        
        // Also try to get from the article editor if available
        if (typeof articleEditor !== 'undefined' && articleEditor.articles) {
            this.articles = articleEditor.articles;
        }

        // Fallback demo data if nothing loaded
        if (!this.articles || this.articles.length === 0) {
            this.articles = [
                { title: 'Professionelle Stockvideo Produktion', publishDate: '2026-03-15', status: 'published' },
                { title: 'Stockvideo Qualität', publishDate: '2026-03-20', status: 'published' },
                { title: 'Stockvideos lizenzieren', publishDate: '2026-03-25', status: 'published' },
                { title: 'Stockvideos für Social Media', publishDate: '2026-04-01', status: 'published' },
                { title: 'Stockvideo Marketing', publishDate: '2026-04-05', status: 'published' },
                { title: 'Stockvideo Trends 2026', publishDate: '2026-04-15', status: 'scheduled' },
                { title: 'Drohnen Stockvideos', publishDate: '2026-04-22', status: 'scheduled' },
                { title: 'KI und Stockvideo', publishDate: '2026-05-01', status: 'draft' },
                { title: 'Stockvideo SEO Tipps', publishDate: '2026-05-10', status: 'draft' },
                { title: 'Stockvideo Preisgestaltung', publishDate: '2026-05-18', status: 'draft' }
            ];
        }
    },

    render() {
        this.loadArticles();
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;

        const year = this.currentYear;
        const month = this.currentMonth;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

        const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
        document.getElementById('calendar-month-title').textContent = monthNames[month] + ' ' + year;

        const days = ['Mo','Di','Mi','Do','Fr','Sa','So'];
        let html = days.map(d => '<div class="calendar-header-cell">' + d + '</div>').join('');

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Previous month padding
        const prevLast = new Date(year, month, 0).getDate();
        for (let i = startDow - 1; i >= 0; i--) {
            html += '<div class="calendar-cell other-month"><div class="calendar-cell-day">' + (prevLast - i) + '</div></div>';
        }

        // Current month days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
            const isToday = dateStr === todayStr;
            const dayArticles = this.articles.filter(a => a.publishDate === dateStr);
            
            let cellHtml = '<div class="calendar-cell' + (isToday ? ' today' : '') + '" onclick="calendarModule.selectDay(\'' + dateStr + '\')">';
            cellHtml += '<div class="calendar-cell-day">' + d + '</div>';
            dayArticles.forEach(a => {
                const status = a.status || 'draft';
                cellHtml += '<div class="calendar-article-pill status-' + status + '" title="' + a.title + '" data-id="' + a.id + '" style="cursor:pointer" onclick="admin.switchPanel(\'articles\');setTimeout(function(){adminArticles.openEditor(\'' + a.id + '\')},100)">' + a.title + '</div>';
            });
            cellHtml += '</div>';
            html += cellHtml;
        }

        // Next month padding
        const totalCells = startDow + lastDay.getDate();
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += '<div class="calendar-cell other-month"><div class="calendar-cell-day">' + i + '</div></div>';
        }

        grid.innerHTML = html;
    },

    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
        this.render();
    },

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
        this.render();
    },

    selectDay(dateStr) {
        const dayArticles = this.articles.filter(a => a.publishDate === dateStr);
        const detail = document.getElementById('calendar-day-detail');
        const titleEl = document.getElementById('calendar-detail-title');
        const listEl = document.getElementById('calendar-detail-articles');

        if (dayArticles.length === 0) {
            detail.style.display = 'none';
            return;
        }

        const d = new Date(dateStr);
        const opts = { day: 'numeric', month: 'long', year: 'numeric' };
        titleEl.textContent = d.toLocaleDateString('de-DE', opts);

        listEl.innerHTML = dayArticles.map(a => {
            const colors = { published: '#34c759', scheduled: '#007aff', draft: '#8e8e93' };
            const labels = { published: 'Veröffentlicht', scheduled: 'Geplant', draft: 'Entwurf' };
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #333;">' +
                '<span style="width:8px;height:8px;border-radius:50%;background:' + (colors[a.status]||'#888') + ';flex-shrink:0;"></span>' +
                '<div style="flex:1;"><div style="color:#fff;font-size:14px;">' + a.title + '</div>' +
                '<div style="color:#888;font-size:12px;">' + (labels[a.status]||'Entwurf') + '</div></div></div>';
        }).join('');
        detail.style.display = 'block';
    }
};
