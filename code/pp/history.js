/**
 * PhotoDev Picture Editing History Engine
 * Uses Browser Website Cache (IndexedDB) to persist and restore multi-layer projects,
 * canvas states, thumbnails, and edit histories across browser restarts.
 * Developed by Vishva Dev.
 */
(function(window) {
  'use strict';

  var DB_NAME = 'PhotoDev_BrowserCache';
  var DB_VERSION = 1;
  var STORE_NAME = 'editing_history';
  var MAX_ITEMS = 25;

  var dbInstance = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (dbInstance) return resolve(dbInstance);
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = function(e) {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = function(e) {
        reject(req.error);
      };
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTimeAgo(ts) {
    if (!ts) return '';
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 15) return 'Just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  var PhotoDevHistory = {
    // 1. Storage Operations
    save: function(item) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);

          if (!item.id) item.id = 'pd_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          item.updatedAt = Date.now();
          item.sizeBytes = item.buffer ? item.buffer.byteLength : (item.sizeBytes || 0);
          item.sizeStr = formatBytes(item.sizeBytes);

          store.put(item);

          tx.oncomplete = function() {
            PhotoDevHistory.prune();
            PhotoDevHistory.triggerChange();
            resolve(item);
          };
          tx.onerror = function() {
            reject(tx.error);
          };
        });
      });
    },

    getAll: function() {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var index = store.index('updatedAt');
          var req = index.openCursor(null, 'prev');
          var items = [];
          req.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
              items.push(cursor.value);
              cursor.continue();
            } else {
              resolve(items);
            }
          };
          req.onerror = function() {
            reject(req.error);
          };
        });
      });
    },

    get: function(id) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var req = store.get(id);
          req.onsuccess = function() {
            resolve(req.result);
          };
          req.onerror = function() {
            reject(req.error);
          };
        });
      });
    },

    delete: function(id, skipConfirm) {
      if (!skipConfirm) {
        return this.confirmDelete(id);
      }
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          store.delete(id);
          tx.oncomplete = function() {
            PhotoDevHistory.triggerChange();
            resolve();
          };
          tx.onerror = function() {
            reject(tx.error);
          };
        });
      });
    },

    clearAll: function(skipConfirm) {
      if (!skipConfirm) {
        return this.confirmClearAll();
      }
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          store.clear();
          tx.oncomplete = function() {
            PhotoDevHistory.triggerChange();
            resolve();
          };
          tx.onerror = function() {
            reject(tx.error);
          };
        });
      });
    },

    prune: function() {
      this.getAll().then(function(all) {
        if (all.length > MAX_ITEMS) {
          var toRemove = all.slice(MAX_ITEMS);
          toRemove.forEach(function(it) {
            PhotoDevHistory.delete(it.id, true);
          });
        }
      });
    },

    // Confirmation Pop-up Dialog
    showConfirmDialog: function(options) {
      var existing = document.getElementById('pd-confirm-popup');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

      var popup = document.createElement('div');
      popup.id = 'pd-confirm-popup';
      popup.className = 'pd-confirm-popup';
      popup.innerHTML = `
        <div class="pd-confirm-backdrop"></div>
        <div class="pd-confirm-box" role="dialog" aria-modal="true" aria-labelledby="pd-confirm-title">
          <div class="pd-confirm-header">
            <div class="pd-confirm-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </div>
            <div class="pd-confirm-title" id="pd-confirm-title">${options.title || 'Confirm Deletion'}</div>
          </div>
          <div class="pd-confirm-body">
            <p class="pd-confirm-msg">${options.message || 'Are you sure you want to delete this item?'}</p>
          </div>
          <div class="pd-confirm-actions">
            <button class="pd-confirm-btn pd-confirm-btn-cancel" id="pd-confirm-cancel">Cancel</button>
            <button class="pd-confirm-btn ${options.confirmClass || 'pd-confirm-btn-danger'}" id="pd-confirm-proceed">${options.confirmText || 'Delete'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(popup);

      // Trigger animation
      requestAnimationFrame(function() {
        popup.classList.add('visible');
      });

      function closePopup() {
        popup.classList.remove('visible');
        setTimeout(function() {
          if (popup.parentNode) popup.parentNode.removeChild(popup);
        }, 220);
      }

      var backdrop = popup.querySelector('.pd-confirm-backdrop');
      var cancelBtn = popup.querySelector('#pd-confirm-cancel');
      var proceedBtn = popup.querySelector('#pd-confirm-proceed');

      if (backdrop) backdrop.onclick = closePopup;
      if (cancelBtn) cancelBtn.onclick = closePopup;

      if (proceedBtn) {
        proceedBtn.onclick = function() {
          closePopup();
          if (typeof options.onConfirm === 'function') {
            options.onConfirm();
          }
        };
      }

      var keyHandler = function(e) {
        if (e.key === 'Escape') {
          window.removeEventListener('keydown', keyHandler);
          closePopup();
        }
      };
      window.addEventListener('keydown', keyHandler);
    },

    confirmDelete: function(id, customName) {
      var self = this;
      return new Promise(function(resolve) {
        var proceedWithPrompt = function(itemName) {
          self.showConfirmDialog({
            title: 'Delete History Picture?',
            message: 'Are you sure you want to delete <strong>"' + (itemName || 'this picture') + '"</strong> from your browser picture editing history cache?<br><span style="color:rgba(255,255,255,0.45); font-size:12px; display:inline-block; margin-top:6px;">This action cannot be undone.</span>',
            confirmText: 'Delete Picture',
            confirmClass: 'pd-confirm-btn-danger',
            onConfirm: function() {
              self.delete(id, true).then(function() {
                self.showToast('Deleted "' + (itemName || 'picture') + '" from browser cache');
                resolve(true);
              });
            }
          });
        };

        if (customName) {
          proceedWithPrompt(customName);
        } else {
          self.get(id).then(function(item) {
            proceedWithPrompt(item ? item.name : 'Untitled Canvas');
          }).catch(function() {
            proceedWithPrompt('Untitled Canvas');
          });
        }
      });
    },

    confirmClearAll: function() {
      var self = this;
      return new Promise(function(resolve) {
        self.getAll().then(function(items) {
          var count = items ? items.length : 0;
          if (count === 0) {
            self.showToast('Browser editing history cache is already empty.');
            resolve(false);
            return;
          }

          self.showConfirmDialog({
            title: 'Clear All Picture Editing History?',
            message: 'Are you sure you want to clear all <strong>' + count + ' cached picture project' + (count === 1 ? '' : 's') + '</strong> from your browser website cache?<br><span style="color:rgba(255,255,255,0.45); font-size:12px; display:inline-block; margin-top:6px;">All saved picture editing history will be permanently deleted.</span>',
            confirmText: 'Clear All Cache',
            confirmClass: 'pd-confirm-btn-danger',
            onConfirm: function() {
              self.clearAll(true).then(function() {
                self.showToast('Cleared all picture editing history from browser cache');
                resolve(true);
              });
            }
          });
        });
      });
    },

    // 2. Open Project from History Cache
    open: function(id) {
      this.get(id).then(function(item) {
        if (!item || !item.buffer) {
          alert('Could not find project data in browser cache.');
          return;
        }
        console.log('[PhotoDevHistory] Opening project from cache:', item.name);
        window.postMessage(item.buffer, '*');
        
        // Hide modal if open
        PhotoDevHistory.closeModal();

        // Bind history ID to document
        setTimeout(function() {
          var app = window.__photoDevApp;
          if (app && app.ju && app.ju()) {
            app.ju().__historyId = item.id;
            app.ju().__lastHistoryWn = app.ju().wn;
          }
        }, 600);

        PhotoDevHistory.showToast('Restored "' + item.name + '" from browser cache');
      }).catch(function(err) {
        console.error('[PhotoDevHistory] Open error:', err);
      });
    },

    // 3. Capture Active Document Snapshot
    captureActiveDocument: function(customName, isSilent) {
      var app = window.__photoDevApp;
      if (!app || !app.ju) return;
      var doc = app.ju();
      if (!doc) return;

      var name = customName || doc.name || 'Untitled Canvas';
      var w = doc.s || 1000;
      var h = doc.T || 700;

      try {
        var engine = window.__photoDevEngine || (typeof a1 !== 'undefined' ? a1 : null);
        if (!engine || !engine._z) {
          console.warn('[PhotoDevHistory] Engine not ready for capture');
          return;
        }

        // Generate PSD buffer
        var psdBuf = engine._z(doc, 'psd', 0, 0, [!0, !1, !0, !1, !0]);
        if (!psdBuf || psdBuf.byteLength === 0) return;

        // Generate JPEG thumbnail Data URL
        var thumb = '';
        try {
          var comp = doc.K6();
          if (comp) {
            var rawBuf = comp.buffer ? (comp.byteOffset === 0 && comp.byteLength === comp.buffer.byteLength ? comp.buffer : comp.slice().buffer) : comp;
            if (rawBuf instanceof ArrayBuffer) {
              thumb = engine.c3(rawBuf, w, h, 'jpeg', 0.6);
            }
          }
        } catch(e) {
          console.warn('[PhotoDevHistory] Thumbnail generation note:', e);
        }

        var projId = doc.__historyId || ('pd_' + Date.now());
        doc.__historyId = projId;
        doc.__lastHistoryWn = doc.wn;

        this.save({
          id: projId,
          name: name,
          width: w,
          height: h,
          thumbnail: thumb,
          buffer: psdBuf
        }).then(function(saved) {
          console.log('[PhotoDevHistory] Snapshot saved to cache:', saved.name, saved.sizeStr);
          if (!isSilent) {
            PhotoDevHistory.showToast('Project saved to browser cache: ' + saved.name);
          }
        });
      } catch(e) {
        console.error('[PhotoDevHistory] Capture error:', e);
      }
    },

    // 4. Toast Notifications
    showToast: function(msg) {
      var toast = document.getElementById('pd-history-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pd-history-toast';
        toast.className = 'pd-history-toast';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add('visible');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function() {
        toast.classList.remove('visible');
      }, 3500);
    },

    // 5. Change Notification Listeners
    _listeners: [],
    onChange: function(cb) {
      this._listeners.push(cb);
    },
    triggerChange: function() {
      this._listeners.forEach(function(fn) {
        try { fn(); } catch(e) {}
      });
      this.updateUI();
    },

    // 6. UI Rendering & Synchronization
    initUI: function() {
      var self = this;
      this.injectStyles();
      this.injectTopbarButton();
      this.injectModal();
      this.updateUI();

      // Listen for changes
      this.onChange(function() {
        self.updateUI();
      });

      // Auto-save loop: catches newly opened/created projects and edits
      setInterval(function() {
        var app = window.__photoDevApp;
        if (!app || !app.ju) return;
        var doc = app.ju();
        if (!doc) return;
        if (!doc.__historyId) {
          // Newly opened or created project
          doc.__historyId = 'pd_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          doc.__lastHistoryWn = doc.wn;
          setTimeout(function() {
            self.captureActiveDocument(null, true);
          }, 1200);
        } else if (doc.wn !== undefined && doc.wn !== doc.__lastHistoryWn) {
          // Document was edited
          doc.__lastHistoryWn = doc.wn;
          clearTimeout(self._editDebounceTimer);
          self._editDebounceTimer = setTimeout(function() {
            self.captureActiveDocument(null, true);
          }, 2000);
        }
      }, 2000);

      // On beforeunload snapshot
      window.addEventListener('beforeunload', function() {
        try {
          var app = window.__photoDevApp;
          if (app && app.ju && app.ju()) {
            self.captureActiveDocument(null, true);
          }
        } catch(e) {}
      });

      // Hook start screen injection
      this.hookStartScreen();
    },

    updateUI: function() {
      var self = this;
      this.getAll().then(function(items) {
        // Update counts
        var countEls = document.querySelectorAll('.pd-history-count-badge');
        countEls.forEach(function(el) {
          el.textContent = items.length;
          el.style.display = items.length > 0 ? 'inline-block' : 'none';
        });

        // Update Start Screen container
        self.renderStartScreenList(items);

        // Update Modal List
        self.renderModalList(items);
      });
    },

    hookStartScreen: function() {
      var self = this;
      var checkTimer = setInterval(function() {
        // Check for start screen container
        var startBox = document.querySelector('.bhover')?.closest('div')?.parentNode;
        if (startBox && !document.getElementById('pd-start-history-container')) {
          var container = document.createElement('div');
          container.id = 'pd-start-history-container';
          container.className = 'pd-start-history-container';
          startBox.appendChild(container);
          self.updateUI();
        }
      }, 500);
    },

    renderStartScreenList: function(items) {
      var container = document.getElementById('pd-start-history-container');
      if (!container) return;

      if (!items || items.length === 0) {
        container.innerHTML = `
          <div class="pd-history-header">
            <span class="pd-history-title">Recent Picture Editing History</span>
            <span class="pd-history-cache-pill">Browser Cache</span>
          </div>
          <div class="pd-history-empty">
            No cached edits yet. Pictures you open or create will automatically be saved to browser cache history.
          </div>
        `;
        return;
      }

      var html = `
        <div class="pd-history-header">
          <div class="pd-history-title-group">
            <span class="pd-history-title">Recent Picture Editing History</span>
            <span class="pd-history-badge">${items.length}</span>
            <span class="pd-history-cache-pill">Browser Cache</span>
          </div>
          <button class="pd-history-clear-btn" onclick="PhotoDevHistory.confirmClearAll()">Clear All</button>
        </div>
        <div class="pd-history-carousel">
      `;

      items.forEach(function(it) {
        var thumbHtml = it.thumbnail
          ? `<img src="${it.thumbnail}" class="pd-card-img" alt="${it.name}">`
          : `<div class="pd-card-placeholder">PSD</div>`;

        html += `
          <div class="pd-history-card" onclick="PhotoDevHistory.open('${it.id}')" title="Click to open ${it.name}">
            <button class="pd-card-del" onclick="event.stopPropagation(); PhotoDevHistory.confirmDelete('${it.id}')" title="Remove from cache">✕</button>
            <div class="pd-card-thumb-wrap">
              ${thumbHtml}
            </div>
            <div class="pd-card-details">
              <div class="pd-card-name">${it.name}</div>
              <div class="pd-card-specs">${it.width} × ${it.height} px • ${it.sizeStr}</div>
              <div class="pd-card-date">${formatTimeAgo(it.updatedAt)}</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
    },

    renderModalList: function(items) {
      var listEl = document.getElementById('pd-modal-history-list');
      if (!listEl) return;

      if (!items || items.length === 0) {
        listEl.innerHTML = `
          <div class="pd-modal-empty">
            No projects in browser cache yet.<br/>
            Open or create an image, and it will be cached automatically!
          </div>
        `;
        return;
      }

      var html = '';
      items.forEach(function(it) {
        var thumbHtml = it.thumbnail
          ? `<img src="${it.thumbnail}" class="pd-modal-item-img" alt="${it.name}">`
          : `<div class="pd-modal-item-placeholder">PSD</div>`;

        html += `
          <div class="pd-modal-item" onclick="PhotoDevHistory.open('${it.id}')">
            <div class="pd-modal-item-thumb">
              ${thumbHtml}
            </div>
            <div class="pd-modal-item-info">
              <div class="pd-modal-item-title">${it.name}</div>
              <div class="pd-modal-item-meta">${it.width} × ${it.height} px • ${it.sizeStr} • ${formatTimeAgo(it.updatedAt)}</div>
            </div>
            <div class="pd-modal-item-actions" onclick="event.stopPropagation()">
              <button class="pd-btn-open" onclick="PhotoDevHistory.open('${it.id}')">Open</button>
              <button class="pd-btn-del" onclick="PhotoDevHistory.confirmDelete('${it.id}')" title="Delete">✕</button>
            </div>
          </div>
        `;
      });

      listEl.innerHTML = html;
    },

    injectTopbarButton: function() {
      if (document.getElementById('pd-topbar-history-btn')) return;

      var brand = document.querySelector('.topbar-branding');
      var btn = document.createElement('button');
      btn.id = 'pd-topbar-history-btn';
      btn.className = 'pd-topbar-history-btn';
      btn.title = 'Picture Editing History (Browser Cache)';
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle; margin-right:4px;">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
        </svg>History<span class="pd-history-count-badge">0</span>
      `;

      btn.onclick = function() {
        PhotoDevHistory.toggleModal();
      };

      document.body.appendChild(btn);
    },

    injectModal: function() {
      if (document.getElementById('pd-history-modal')) return;

      var modal = document.createElement('div');
      modal.id = 'pd-history-modal';
      modal.className = 'pd-history-modal';
      modal.innerHTML = `
        <div class="pd-modal-backdrop" onclick="PhotoDevHistory.closeModal()"></div>
        <div class="pd-modal-dialog">
          <div class="pd-modal-head">
            <div class="pd-modal-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#31A8FF" style="vertical-align:middle; margin-right:6px;">
                <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
              </svg>
              Picture Editing History
              <span class="pd-modal-cache-tag">Browser Website Cache</span>
            </div>
            <button class="pd-modal-close" onclick="PhotoDevHistory.closeModal()">✕</button>
          </div>
          <div class="pd-modal-toolbar">
            <button class="pd-modal-btn-save" onclick="PhotoDevHistory.captureActiveDocument();">
              💾 Save Current Canvas
            </button>
            <button class="pd-modal-btn-clear" onclick="PhotoDevHistory.confirmClearAll();">
              Clear All Cache
            </button>
          </div>
          <div class="pd-modal-body" id="pd-modal-history-list">
            <!-- Items injected here -->
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    },

    toggleModal: function() {
      var modal = document.getElementById('pd-history-modal');
      if (modal) {
        modal.classList.toggle('open');
        if (modal.classList.contains('open')) {
          this.updateUI();
        }
      }
    },

    closeModal: function() {
      var modal = document.getElementById('pd-history-modal');
      if (modal) modal.classList.remove('open');
    },

    injectStyles: function() {
      if (document.getElementById('pd-history-styles')) return;

      var style = document.createElement('style');
      style.id = 'pd-history-styles';
      style.textContent = `
        /* Topbar History Button */
        .pd-topbar-history-btn {
          position: fixed;
          top: 6px;
          right: 175px;
          z-index: 99998;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #eee;
          padding: 3px 10px;
          border-radius: 4px;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
        }
        .pd-topbar-history-btn:hover {
          background: rgba(49, 168, 255, 0.2);
          border-color: #31A8FF;
          color: #fff;
        }
        .pd-history-count-badge {
          background: #31A8FF;
          color: #000;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 10px;
          margin-left: 5px;
          display: none;
        }

        /* Toast Notification */
        .pd-history-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(50px);
          background: #1e232a;
          color: #fff;
          border: 1px solid #31A8FF;
          padding: 10px 20px;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          z-index: 100000;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pd-history-toast.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        /* Start Screen Container */
        .pd-start-history-container {
          margin-top: 25px;
          width: 100%;
          text-align: left;
          font-family: 'Inter', sans-serif;
        }
        .pd-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .pd-history-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pd-history-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.01em;
        }
        .pd-history-badge {
          background: rgba(49, 168, 255, 0.2);
          color: #31A8FF;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 10px;
          border: 1px solid rgba(49, 168, 255, 0.3);
        }
        .pd-history-cache-pill {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .pd-history-clear-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          cursor: pointer;
          transition: color 0.2s;
        }
        .pd-history-clear-btn:hover {
          color: #ff5555;
        }

        .pd-history-empty {
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          color: rgba(255, 255, 255, 0.35);
          font-size: 12px;
          text-align: center;
        }

        /* Carousel of Recent Cards */
        .pd-history-carousel {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .pd-history-carousel::-webkit-scrollbar {
          height: 5px;
        }
        .pd-history-carousel::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }

        .pd-history-card {
          flex: 0 0 145px;
          background: #1a1e24;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
          user-select: none;
        }
        .pd-history-card:hover {
          background: #222730;
          border-color: #31A8FF;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        .pd-card-del {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.6);
          border: none;
          color: #aaa;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.2s;
          z-index: 2;
        }
        .pd-history-card:hover .pd-card-del {
          opacity: 1;
        }
        .pd-card-del:hover {
          background: #ff4444;
          color: #fff;
        }

        .pd-card-thumb-wrap {
          width: 100%;
          height: 90px;
          background: #111418;
          background-image: repeating-conic-gradient(#1a1e24 0% 25%, #111418 0% 50%) 50% / 12px 12px;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .pd-card-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .pd-card-placeholder {
          font-size: 16px;
          font-weight: 700;
          color: #31A8FF;
        }

        .pd-card-name {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pd-card-specs {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.45);
          margin-top: 2px;
        }
        .pd-card-date {
          font-size: 9px;
          color: #31A8FF;
          margin-top: 4px;
        }

        /* Modal Popup */
        .pd-history-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 99999;
          font-family: 'Inter', sans-serif;
        }
        .pd-history-modal.open {
          display: block;
        }
        .pd-modal-backdrop {
          position: absolute;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(3px);
        }
        .pd-modal-dialog {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 550px;
          max-height: 80vh;
          background: #1c2026;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pd-modal-head {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pd-modal-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
        }
        .pd-modal-cache-tag {
          font-size: 10px;
          background: rgba(49, 168, 255, 0.15);
          color: #31A8FF;
          border: 1px solid rgba(49, 168, 255, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }
        .pd-modal-close {
          background: transparent;
          border: none;
          color: #888;
          font-size: 16px;
          cursor: pointer;
        }
        .pd-modal-close:hover {
          color: #fff;
        }
        .pd-modal-toolbar {
          padding: 10px 20px;
          background: rgba(0,0,0,0.2);
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .pd-modal-btn-save {
          background: #31A8FF;
          color: #000;
          border: none;
          padding: 5px 12px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .pd-modal-btn-save:hover {
          background: #50b7ff;
        }
        .pd-modal-btn-clear {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #bbb;
          padding: 4px 10px;
          border-radius: 5px;
          font-size: 11px;
          cursor: pointer;
        }
        .pd-modal-btn-clear:hover {
          border-color: #ff5555;
          color: #ff5555;
        }

        .pd-modal-body {
          padding: 12px 20px;
          overflow-y: auto;
          flex: 1;
        }
        .pd-modal-empty {
          padding: 40px 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          line-height: 1.6;
        }

        .pd-modal-item {
          display: flex;
          align-items: center;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.2s;
        }
        .pd-modal-item:hover {
          background: rgba(49, 168, 255, 0.08);
          border-color: rgba(49, 168, 255, 0.3);
        }
        .pd-modal-item-thumb {
          width: 56px;
          height: 42px;
          background: #111418;
          border-radius: 4px;
          overflow: hidden;
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pd-modal-item-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .pd-modal-item-placeholder {
          font-size: 11px;
          font-weight: 700;
          color: #31A8FF;
        }
        .pd-modal-item-info {
          flex: 1;
          min-width: 0;
        }
        .pd-modal-item-title {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pd-modal-item-meta {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          margin-top: 2px;
        }
        .pd-modal-item-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 10px;
        }
        .pd-btn-open {
          background: rgba(49, 168, 255, 0.2);
          border: 1px solid rgba(49, 168, 255, 0.4);
          color: #31A8FF;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .pd-btn-open:hover {
          background: #31A8FF;
          color: #000;
        }
        .pd-btn-del {
          background: transparent;
          border: none;
          color: #666;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
        }
        .pd-btn-del:hover {
          color: #ff4444;
        }

        /* Confirmation Pop-up Dialog */
        .pd-confirm-popup {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 100005;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Inter', sans-serif;
        }
        .pd-confirm-popup.visible {
          opacity: 1;
          pointer-events: auto;
        }
        .pd-confirm-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
        }
        .pd-confirm-box {
          position: relative;
          z-index: 2;
          background: #1b1e24;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          width: 90%;
          max-width: 440px;
          padding: 24px;
          transform: scale(0.95) translateY(10px);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }
        .pd-confirm-popup.visible .pd-confirm-box {
          transform: scale(1) translateY(0);
        }
        .pd-confirm-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .pd-confirm-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(235, 77, 75, 0.12);
          border: 1px solid rgba(235, 77, 75, 0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pd-confirm-title {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
        }
        .pd-confirm-body {
          margin-bottom: 22px;
        }
        .pd-confirm-msg {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.75);
        }
        .pd-confirm-msg strong {
          color: #ffffff;
          font-weight: 600;
        }
        .pd-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .pd-confirm-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
        }
        .pd-confirm-btn-cancel {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e0e0e0;
        }
        .pd-confirm-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }
        .pd-confirm-btn-danger {
          background: #eb4d4b;
          border: 1px solid #d63031;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(235, 77, 75, 0.3);
        }
        .pd-confirm-btn-danger:hover {
          background: #ff5252;
          box-shadow: 0 4px 12px rgba(235, 77, 75, 0.45);
        }

        @media (max-width: 650px) {
          .pd-topbar-history-btn {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  window.PhotoDevHistory = PhotoDevHistory;

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      PhotoDevHistory.initUI();
    });
  } else {
    PhotoDevHistory.initUI();
  }

})(window);
