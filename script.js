/* ============================================================
   SISTEM NOTIFIKASI
   ============================================================ */
function notify(msg, type='info'){
  const stack = document.getElementById('notifStack');
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  let icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');
  el.innerHTML = `<span style="font-size:20px;">${icon}</span> <span>${msg}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(100px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/* ============================================================
   SISTEM MODAL CUSTOM (ANTI-BLOKIR PROMPT BROWSER)
   ============================================================ */
let promptCallback = null;

function showPrompt(title, placeholder, callback, defaultValue = '') {
    document.getElementById('prompt-title').textContent = title;
    const input = document.getElementById('prompt-input');
    input.placeholder = placeholder;
    input.value = defaultValue;
    document.getElementById('custom-prompt').style.display = 'flex';
    promptCallback = callback;
    setTimeout(() => input.focus(), 100);
    
    // Tekan "Enter" langsung menyimpan
    input.onkeydown = function(e) {
        if (e.key === 'Enter') submitPrompt();
    };
}

function closePrompt() {
    document.getElementById('custom-prompt').style.display = 'none';
    promptCallback = null;
}

function submitPrompt() {
    const val = document.getElementById('prompt-input').value.trim();
    if(val && promptCallback) {
        promptCallback(val);
    } else if(!val) {
        notify("Nama tidak boleh kosong!", "error");
        return;
    }
    closePrompt();
}

/* MODAL KONFIRMASI (ANTI-BLOKIR) UNTUK HAPUS EVENT / FRAME */
let confirmCallback = null;

function showConfirm(title, msg, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('custom-confirm').style.display = 'flex';
    confirmCallback = callback;
}

function closeConfirm() {
    document.getElementById('custom-confirm').style.display = 'none';
    confirmCallback = null;
}

function submitConfirm() {
    if(confirmCallback) confirmCallback();
    closeConfirm();
}

/* ============================================================
   STATE APLIKASI UTAMA
   ============================================================ */
const S = {
  events: JSON.parse(localStorage.getItem('pb_events') || '[]'),
  savedFrames: JSON.parse(localStorage.getItem('pb_frames') || '[]'),
  selectedEventId: null,
  selectedEventFrame: null,
  kioskMode: false,
  stream: null,
  
  // Fitur Kamera External
  selectedCameraId: localStorage.getItem('pb_camera_id') || null,
  
  // ALL IN ONE MEDIA RESULTS
  eventShots: [], // Raw Photos Array
  frameResultUrl: null, // Final Composed Image
  gifVideoUrl: null,    // Slideshow Boomerang WebM
  btsVideoUrl: null,    // Background recording WebM
  
  // Active state for Result Screen
  activeResultTab: 'frame' 
};

// Deklarasi Warna Kotak Event
const PASTEL_COLORS = ['var(--block-lime)', 'var(--block-lavender)', 'var(--block-mint)', 'var(--block-cream)', 'var(--block-pink)', 'var(--block-coral)'];

/* =======================================================================
   KODE JAVASCRIPT LAYOUT BUILDER (EDITOR FRAME FOTO)
   ======================================================================= */
const LB = {
  canvas: null, ctx: null, canvasW: 1200, canvasH: 1800, elements: [], selectedId: null, dragState: null,
  editingFrameId: null, // Track frame mana yang sedang di-edit
  HANDLE_SIZE_MOUSE: 22, HANDLE_SIZE_TOUCH: 55, // radius hit area handle
  
  init() {
    this.canvas = document.getElementById('layoutCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.applyCustomSize();
    this.canvas.addEventListener('mousedown', (e) => this.onDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMove(e));
    this.canvas.addEventListener('mouseup', () => this.onUp());
    this.canvas.addEventListener('mouseleave', () => this.onUp());

    if(('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); const touch = e.touches[0]; this.onDown({ clientX: touch.clientX, clientY: touch.clientY, isTouch: true });
        }, {passive: false});
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); const touch = e.touches[0]; this.onMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, {passive: false});
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.onUp(); });
    }
  },
  resetCanvas() {
    this.elements = [];
    this.selectedId = null;
    this.editingFrameId = null;
    this.canvasW = 1200; 
    this.canvasH = 1800;
    document.getElementById('lbCanvasW').value = this.canvasW;
    document.getElementById('lbCanvasH').value = this.canvasH;
    document.getElementById('lbBgColor').value = '#ffffff';
    this.applyCustomSize();
    this.updateUI();
    notify("Canvas frame berhasil dikosongkan.", "info");
  },
  async loadFrame(id) {
      const frame = await window.FrameStore.findById(id);
      if(!frame) return;
      this.editingFrameId = frame.id;
      this.canvasW = frame.config.canvas.w;
      this.canvasH = frame.config.canvas.h;
      document.getElementById('lbCanvasW').value = this.canvasW;
      document.getElementById('lbCanvasH').value = this.canvasH;
      document.getElementById('lbBgColor').value = frame.config.bgColor;
      
      this.elements = [];
      let promises = [];
      frame.config.elements.forEach(el => {
          if(el.type === 'image' && el.src) {
              promises.push(new Promise(res => {
                  const img = new Image();
                  img.onload = () => { this.elements.push({...el, imgData:img}); res(); };
                  img.onerror = () => { this.elements.push({...el, imgData:null}); res(); };
                  img.src = el.src;
              }));
          } else { this.elements.push({...el}); }
      });
      await Promise.all(promises);
      this.selectedId = null;
      this.applyCustomSize();
      this.updateUI();
      closeFrameManager();
      notify("Frame dimuat untuk diedit!", "success");
  },
  deleteFrame(id) {
      showConfirm("Hapus Frame?", "Anda yakin ingin menghapus frame desain ini?", () => {
          if (!window.FrameStore.delete(id)) {
              notify("Frame bawaan tidak bisa dihapus.", "error"); return;
          }
          S.savedFrames = JSON.parse(localStorage.getItem('pb_frames') || '[]');
          openFrameManager(); // Refresh daftar frame di modal
          if(this.editingFrameId === id) this.resetCanvas();
          renderEvents();
          notify("Frame berhasil dihapus!", "success");
      });
  },
  switchTab(tab) {
    document.querySelectorAll('.lb-mobile-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-btn-' + tab).classList.add('active');
    if(window.innerWidth <= 900) {
       document.getElementById('lb-panel-setup').classList.toggle('mobile-active', tab === 'setup');
       document.getElementById('lb-panel-props').classList.toggle('mobile-active', tab === 'props');
    }
  },
  changePaperSize() {
    const val = document.getElementById('lbPaperSize').value;
    const sizes = { '4R': { w: 1200, h: 1800 }, 'strip': { w: 600, h: 1800 }, 'A4': { w: 2480, h: 3508 }, 'square': { w: 1500, h: 1500 } };
    if (sizes[val]) { document.getElementById('lbCanvasW').value = sizes[val].w; document.getElementById('lbCanvasH').value = sizes[val].h; this.applyCustomSize(); }
  },
  applyCustomSize() {
    this.canvasW = parseInt(document.getElementById('lbCanvasW').value) || 1200;
    this.canvasH = parseInt(document.getElementById('lbCanvasH').value) || 1800;
    this.canvas.width = this.canvasW; this.canvas.height = this.canvasH;
    this.redraw();
  },
  printCanvas() {
    this.selectedId = null; this.redraw();
    const dataUrl = this.canvas.toDataURL('image/jpeg', 1.0);
    const win = window.open('', '_blank');
    win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#ccc;height:100vh;"><img src="${dataUrl}" style="max-width:100%;max-height:100vh;box-shadow:0 0 10px rgba(0,0,0,0.5);" onload="window.print(); window.close();"></body></html>`);
  },
  addZone() {
    const w = Math.floor(this.canvasW * 0.6), h = Math.floor(this.canvasH * 0.25);
    const id = Date.now(); this.elements.push({ id, type: 'zone', x: 50, y: 50, w, h }); this.selectedId = id;
    this.switchTab('props'); this.updateUI();
  },
  addImageLayer(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result; const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > this.canvasW * 0.8) { const ratio = (this.canvasW * 0.8) / w; w = w * ratio; h = h * ratio; }
        const id = Date.now(); this.elements.push({ id, type: 'image', x: 50, y: 50, w, h, src, imgData: img }); this.selectedId = id;
        this.switchTab('props'); this.updateUI();
      }; img.src = src;
    }; reader.readAsDataURL(file); input.value = '';
  },
  moveLayerUp() {
    if(!this.selectedId) return; const idx = this.elements.findIndex(e => e.id === this.selectedId);
    if(idx < this.elements.length - 1) { const temp = this.elements[idx]; this.elements[idx] = this.elements[idx + 1]; this.elements[idx + 1] = temp; this.updateUI(); }
  },
  moveLayerDown() {
    if(!this.selectedId) return; const idx = this.elements.findIndex(e => e.id === this.selectedId);
    if(idx > 0) { const temp = this.elements[idx]; this.elements[idx] = this.elements[idx - 1]; this.elements[idx - 1] = temp; this.updateUI(); }
  },
  deleteSelected() { if(!this.selectedId) return; this.elements = this.elements.filter(e => e.id !== this.selectedId); this.selectedId = null; this.updateUI(); },
  _handles(el) {
    const { x, y, w, h } = el;
    return [
      { id: 'tl', cx: x,     cy: y     }, { id: 'tc', cx: x+w/2, cy: y     },
      { id: 'tr', cx: x+w,   cy: y     }, { id: 'ml', cx: x,     cy: y+h/2 },
      { id: 'mr', cx: x+w,   cy: y+h/2 }, { id: 'bl', cx: x,     cy: y+h   },
      { id: 'bc', cx: x+w/2, cy: y+h   }, { id: 'br', cx: x+w,   cy: y+h   },
    ];
  },
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvasW / rect.width, scaleY = this.canvasH / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  },
  onDown(e) {
    const { x, y } = this.getMousePos(e);
    const hs = e.isTouch ? this.HANDLE_SIZE_TOUCH : this.HANDLE_SIZE_MOUSE;
    if (this.selectedId) {
      const selEl = this.elements.find(el => el.id === this.selectedId);
      if (selEl) {
        for (const h of this._handles(selEl)) {
          if (Math.abs(x - h.cx) <= hs && Math.abs(y - h.cy) <= hs) {
            this.dragState = { action: 'resize', handle: h.id, startX: x, startY: y,
              origX: selEl.x, origY: selEl.y, origW: selEl.w, origH: selEl.h };
            return;
          }
        }
      }
    }
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) {
        this.selectedId = el.id;
        this.dragState = { action: 'move', startX: x, startY: y, origX: el.x, origY: el.y };
        this.updateUI(); this.switchTab('props'); return;
      }
    }
    this.selectedId = null; this.updateUI();
  },
  onMove(e) {
    if (!this.dragState || !this.selectedId) return;
    const { x, y } = this.getMousePos(e);
    const dx = x - this.dragState.startX, dy = y - this.dragState.startY;
    const el = this.elements.find(el => el.id === this.selectedId);
    if (!el) return;
    if (this.dragState.action === 'move') {
      el.x = this.dragState.origX + dx;
      el.y = this.dragState.origY + dy;
    } else if (this.dragState.action === 'resize') {
      const { handle, origX, origY, origW, origH } = this.dragState;
      let nx = origX, ny = origY, nw = origW, nh = origH;
      if (handle === 'mr' || handle === 'tr' || handle === 'br') { nw = Math.max(50, origW + dx); }
      if (handle === 'ml' || handle === 'tl' || handle === 'bl') { const nw2 = Math.max(50, origW - dx); nx = origX + origW - nw2; nw = nw2; }
      if (handle === 'bc' || handle === 'bl' || handle === 'br') { nh = Math.max(50, origH + dy); }
      if (handle === 'tc' || handle === 'tl' || handle === 'tr') { const nh2 = Math.max(50, origH - dy); ny = origY + origH - nh2; nh = nh2; }
      if (handle === 'tc' || handle === 'bc') { nx = origX; nw = origW; }
      if (handle === 'ml' || handle === 'mr') { ny = origY; nh = origH; }
      el.x = nx; el.y = ny; el.w = nw; el.h = nh;
    }
    this.updateUI(false); this.redraw();
  },
  onUp() { if (this.dragState) { this.updateUI(true); } this.dragState = null; },
  updateUI(rebuildList = true) {
    const el = this.elements.find(e => e.id === this.selectedId);
    if (el) {
      document.getElementById('lbPropPanel').style.display = 'flex'; document.getElementById('lbPropEmpty').style.display = 'none';
      document.getElementById('propX').value = Math.round(el.x); document.getElementById('propY').value = Math.round(el.y);
      document.getElementById('propW').value = Math.round(el.w); document.getElementById('propH').value = Math.round(el.h);
    } else { document.getElementById('lbPropPanel').style.display = 'none'; document.getElementById('lbPropEmpty').style.display = 'block'; }
    if (rebuildList) {
      const list = document.getElementById('lbLayerList'); list.innerHTML = '';
      [...this.elements].reverse().forEach(item => {
        const div = document.createElement('div'); div.className = `layer-item ${this.selectedId === item.id ? 'active' : ''}`;
        let iconHtml = '', title = '';
        if (item.type === 'zone') {
            const actualIndex = this.elements.findIndex(e => e.id === item.id);
            const zNum = this.elements.slice(0, actualIndex + 1).filter(e => e.type === 'zone').length;
            iconHtml = `<div class="layer-icon" style="background:var(--primary); color:white; border:none;">${zNum}</div>`; title = `Zona Foto Wajah ${zNum}`;
        } else { iconHtml = `<div class="layer-icon"><img src="${item.src}"></div>`; title = `Gambar Dekorasi`; }
        div.innerHTML = `<div style="display:flex; align-items:center; gap:14px;">${iconHtml}<span style="font-weight:700; font-size:13px;">${title}</span></div>`;
        div.onclick = () => { this.selectedId = item.id; this.updateUI(); }; list.appendChild(div);
      });
    }
    this.redraw();
  },
  updateProps() {
    const el = this.elements.find(e => e.id === this.selectedId); if (!el) return;
    el.x = parseFloat(document.getElementById('propX').value) || 0; el.y = parseFloat(document.getElementById('propY').value) || 0;
    el.w = parseFloat(document.getElementById('propW').value) || 100; el.h = parseFloat(document.getElementById('propH').value) || 100; this.redraw();
  },
  redraw() {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.canvasW, this.canvasH);
    ctx.fillStyle = document.getElementById('lbBgColor').value; ctx.fillRect(0, 0, this.canvasW, this.canvasH);
    let zoneCounter = 1;
    this.elements.forEach(el => {
      if (el.type === 'image' && el.imgData) { ctx.drawImage(el.imgData, el.x, el.y, el.w, el.h); } 
      else if (el.type === 'zone') {
        ctx.fillStyle = 'rgba(17,17,17,0.1)'; ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.fillStyle = 'rgba(17,17,17,0.5)'; ctx.font = `bold ${Math.min(60, el.w * 0.25)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(zoneCounter++, el.x + el.w / 2, el.y + el.h / 2);
      }
      if (this.selectedId === el.id) {
        // Border seleksi
        ctx.strokeStyle = '#e91e8c'; ctx.lineWidth = 5; ctx.strokeRect(el.x, el.y, el.w, el.h);
        // 8 handle resize — kotak kecil seperti style editor asli
        const HS = 22; // setengah ukuran kotak handle
        this._handles(el).forEach(h => {
          ctx.fillStyle = 'var(--accent-magenta)'; ctx.fillRect(h.cx - HS, h.cy - HS, HS*2, HS*2);
          ctx.fillStyle = 'white'; ctx.fillRect(h.cx - HS + 5, h.cy - HS + 5, HS*2 - 10, HS*2 - 10);
        });
      }
    });
  }
};

/* FUNGSI MODAL MANAJER FRAME */
async function openFrameManager() {
    if(!S.selectedEventId) { notify("Pilih Event terlebih dahulu!", "error"); return; }
    const list = document.getElementById('frame-manager-list');
    const frames = await window.FrameStore.getForEvent(S.selectedEventId);

    if(frames.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;font-weight:600;color:rgba(17,17,17,0.5);">Belum ada frame yang dibuat untuk event ini.</div>`;
        document.getElementById('frame-manager-modal').style.display = 'flex';
        return;
    }

    // Buat kartu tiap frame dengan preview on-the-fly
    list.innerHTML = '';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '12px';

    for(const f of frames) {
        let previewSrc = f.preview || '';
        if(!previewSrc && f.config) {
            try { previewSrc = await composeEventLayout([], f.config); } catch(e) { previewSrc = ''; }
        }
        const isBuiltin = String(f.id).startsWith('built_');
        const card = document.createElement('div');
        card.dataset.frameId = f.id;
        card.draggable = !isBuiltin;
        card.style.cssText = `
            display:flex; align-items:center; gap:16px;
            border:1px solid var(--hairline); border-radius:12px;
            padding:12px 16px; background:white;
            cursor:${isBuiltin ? 'default' : 'grab'};
            transition: box-shadow 0.15s, opacity 0.15s;
        `;
        card.innerHTML = `
            <div style="font-size:20px;color:rgba(17,17,17,0.25);flex-shrink:0;user-select:none;">
                ${isBuiltin ? '🔒' : '⠿'}
            </div>
            <img src="${previewSrc}" style="width:72px;height:72px;object-fit:contain;border-radius:6px;background:var(--surface-soft);border:1px solid var(--hairline-soft);flex-shrink:0;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
                <div style="font-size:11px;color:rgba(17,17,17,0.4);margin-top:2px;">${isBuiltin ? 'Frame bawaan' : 'Frame kustom'}</div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="btn secondary" style="padding:8px 14px;font-size:12px;" onclick="LB.loadFrame('${f.id}')">✏️ Edit</button>
                ${isBuiltin
                    ? `<button class="btn secondary" style="padding:8px 14px;font-size:12px;opacity:0.4;cursor:not-allowed;" disabled title="Frame bawaan tidak bisa dihapus">🔒</button>`
                    : `<button class="btn danger" style="padding:8px 14px;font-size:12px;" onclick="LB.deleteFrame('${f.id}')">🗑️</button>`
                }
            </div>
        `;

        // Drag & drop hanya untuk frame user (bukan built-in)
        if(!isBuiltin) {
            card.addEventListener('dragstart', e => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', f.id);
                card.style.opacity = '0.4';
            });
            card.addEventListener('dragend', () => { card.style.opacity = '1'; });
            card.addEventListener('dragover', e => {
                e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                card.style.boxShadow = '0 0 0 2px var(--primary)';
            });
            card.addEventListener('dragleave', () => { card.style.boxShadow = ''; });
            card.addEventListener('drop', e => {
                e.preventDefault(); card.style.boxShadow = '';
                const draggedId = e.dataTransfer.getData('text/plain');
                if(draggedId === String(f.id)) return;
                // Reorder di localStorage
                const stored = JSON.parse(localStorage.getItem('pb_frames') || '[]');
                const fromIdx = stored.findIndex(x => String(x.id) === String(draggedId));
                const toIdx   = stored.findIndex(x => String(x.id) === String(f.id));
                if(fromIdx === -1 || toIdx === -1) return;
                const [moved] = stored.splice(fromIdx, 1);
                stored.splice(toIdx, 0, moved);
                localStorage.setItem('pb_frames', JSON.stringify(stored));
                S.savedFrames = stored;
                openFrameManager(); // refresh tampilan
            });
        }
        list.appendChild(card);
    }
    document.getElementById('frame-manager-modal').style.display = 'flex';
}
function closeFrameManager() { document.getElementById('frame-manager-modal').style.display = 'none'; }


/* =======================================================================
   KODE JAVASCRIPT HOME BUILDER (EDITOR KIOSK START SCREEN)
   ======================================================================= */
const HB = {
  canvas: null, ctx: null, canvasW: 1080, canvasH: 1920, elements: [], selectedId: null, dragState: null,
  init() {
    this.canvas = document.getElementById('homeCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.applyCustomSize();
    this.canvas.addEventListener('mousedown', (e) => this.onDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMove(e));
    this.canvas.addEventListener('mouseup', () => this.onUp());
    this.canvas.addEventListener('mouseleave', () => this.onUp());

    if(('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); const touch = e.touches[0]; this.onDown({ clientX: touch.clientX, clientY: touch.clientY, isTouch: true });
        }, {passive: false});
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); const touch = e.touches[0]; this.onMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, {passive: false});
        this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.onUp(); });
    }
  },
  loadFromEvent() {
    const event = S.events.find(e => e.id === S.selectedEventId);
    if(event && event.homeScreen) {
        this.canvasW = event.homeScreen.canvas.w;
        this.canvasH = event.homeScreen.canvas.h;
        document.getElementById('hbCanvasW').value = this.canvasW;
        document.getElementById('hbCanvasH').value = this.canvasH;
        document.getElementById('hbBgColor').value = event.homeScreen.bgColor;
        
        // Load elements and restore Image objects for rendering
        this.elements = [];
        let promises = [];
        event.homeScreen.elements.forEach(el => {
            if(el.type === 'image' && el.src) {
                promises.push(new Promise(res => {
                    const img = new Image();
                    img.onload = () => { this.elements.push({ ...el, imgData: img }); res(); };
                    img.onerror = () => { this.elements.push({ ...el, imgData: null }); res(); };
                    img.src = el.src;
                }));
            } else {
                this.elements.push({...el});
            }
        });

        Promise.all(promises).then(() => {
            this.selectedId = null;
            this.updateUI();
            this.applyCustomSize();
        });
    } else {
        // Default Setup dengan tema Cream Pastel
        this.elements = [];
        document.getElementById('hbBgColor').value = '#fcead1';
        document.getElementById('hbCanvasW').value = 1080;
        document.getElementById('hbCanvasH').value = 1920;
        this.applyCustomSize();
        this.updateUI();
    }
  },
  saveToEvent() {
    const event = S.events.find(e => e.id === S.selectedEventId);
    if(event) {
        const elementsData = this.elements.map(el => {
            if(el.type === 'image') return { ...el, imgData: null }; // strip image object for JSON
            return el;
        });
        event.homeScreen = {
            canvas: { w: this.canvasW, h: this.canvasH },
            bgColor: document.getElementById('hbBgColor').value,
            elements: elementsData
        };
        localStorage.setItem('pb_events', JSON.stringify(S.events));
        this.selectedId = null; this.redraw();
        notify("Desain Home Screen berhasil disimpan!", "success");
    }
  },
  deleteFromEvent() {
    showConfirm("Hapus Layar Kiosk?", "Apakah Anda yakin ingin mereset layar utama Kiosk untuk event ini?", () => {
        const event = S.events.find(e => e.id === S.selectedEventId);
        if(event) {
            event.homeScreen = null;
            localStorage.setItem('pb_events', JSON.stringify(S.events));
            this.loadFromEvent(); // Load kembali tampilan default
            notify("Layar Kiosk berhasil direset ke Default!", "success");
        }
    });
  },
  switchTab(tab) {
    document.querySelectorAll('#screen-home .lb-mobile-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('hb-tab-btn-' + tab).classList.add('active');
    if(window.innerWidth <= 900) {
       document.getElementById('hb-panel-setup').classList.toggle('mobile-active', tab === 'setup');
       document.getElementById('hb-panel-props').classList.toggle('mobile-active', tab === 'props');
    }
  },
  changeScreenSize() {
    const val = document.getElementById('hbScreenSize').value;
    const sizes = { 'portrait': { w: 1080, h: 1920 }, 'landscape': { w: 1920, h: 1080 }, 'ipad': { w: 1536, h: 2048 } };
    if (sizes[val]) { document.getElementById('hbCanvasW').value = sizes[val].w; document.getElementById('hbCanvasH').value = sizes[val].h; this.applyCustomSize(); }
  },
  applyCustomSize() {
    this.canvasW = parseInt(document.getElementById('hbCanvasW').value) || 1080;
    this.canvasH = parseInt(document.getElementById('hbCanvasH').value) || 1920;
    this.canvas.width = this.canvasW; this.canvas.height = this.canvasH;
    this.redraw();
  },
  addButton() {
    const w = 480, h = 140;
    const id = Date.now();
    this.elements.push({ id, type: 'button', text: 'MULAI', x: (this.canvasW - w)/2, y: this.canvasH - h - 240, w, h, btnColor: '#111111', textColor: '#ffffff' });
    this.selectedId = id;
    this.switchTab('props'); this.updateUI();
  },
  addImageLayer(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result; const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > this.canvasW * 0.9) { const ratio = (this.canvasW * 0.9) / w; w = w * ratio; h = h * ratio; }
        const id = Date.now(); 
        this.elements.push({ id, type: 'image', x: (this.canvasW - w)/2, y: (this.canvasH - h)/2, w, h, src, imgData: img }); 
        this.selectedId = id;
        this.switchTab('props'); this.updateUI();
      }; img.src = src;
    }; reader.readAsDataURL(file); input.value = '';
  },
  moveLayerUp() {
    if(!this.selectedId) return; const idx = this.elements.findIndex(e => e.id === this.selectedId);
    if(idx < this.elements.length - 1) { const temp = this.elements[idx]; this.elements[idx] = this.elements[idx + 1]; this.elements[idx + 1] = temp; this.updateUI(); }
  },
  moveLayerDown() {
    if(!this.selectedId) return; const idx = this.elements.findIndex(e => e.id === this.selectedId);
    if(idx > 0) { const temp = this.elements[idx]; this.elements[idx] = this.elements[idx - 1]; this.elements[idx - 1] = temp; this.updateUI(); }
  },
  deleteSelected() { if(!this.selectedId) return; this.elements = this.elements.filter(e => e.id !== this.selectedId); this.selectedId = null; this.updateUI(); },
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvasW / rect.width, scaleY = this.canvasH / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  },
  onDown(e) {
    const { x, y } = this.getMousePos(e);
    const handleSize = e.isTouch ? 100 : 40; 
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      const isResize = x >= el.x + el.w - handleSize && x <= el.x + el.w + handleSize && y >= el.y + el.h - handleSize && y <= el.y + el.h + handleSize;
      if (isResize && this.selectedId === el.id) { this.dragState = { action: 'resize', startX: x, startY: y, origW: el.w, origH: el.h }; return; }
      if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) {
        this.selectedId = el.id; this.dragState = { action: 'move', startX: x, startY: y, origX: el.x, origY: el.y };
        this.updateUI(); this.switchTab('props'); return;
      }
    }
    this.selectedId = null; this.updateUI();
  },
  onMove(e) {
    if (!this.dragState || !this.selectedId) return;
    const { x, y } = this.getMousePos(e); const dx = x - this.dragState.startX, dy = y - this.dragState.startY;
    const el = this.elements.find(e => e.id === this.selectedId);
    if (this.dragState.action === 'move') { el.x = this.dragState.origX + dx; el.y = this.dragState.origY + dy; } 
    else if (this.dragState.action === 'resize') { el.w = Math.max(50, this.dragState.origW + dx); el.h = Math.max(50, this.dragState.origH + dy); }
    this.updateUI(false); this.redraw();
  },
  onUp() { this.dragState = null; },
  updateUI(rebuildList = true) {
    const el = this.elements.find(e => e.id === this.selectedId);
    if (el) {
      document.getElementById('hbPropPanel').style.display = 'flex'; document.getElementById('hbPropEmpty').style.display = 'none';
      document.getElementById('hbPropX').value = Math.round(el.x); document.getElementById('hbPropY').value = Math.round(el.y);
      document.getElementById('hbPropW').value = Math.round(el.w); document.getElementById('hbPropH').value = Math.round(el.h);
      
      if(el.type === 'button') {
          document.getElementById('hbButtonProps').style.display = 'block';
          document.getElementById('hbPropText').value = el.text || 'MULAI';
          document.getElementById('hbPropBtnColor').value = el.btnColor || '#111111';
          document.getElementById('hbPropTextColor').value = el.textColor || '#ffffff';
      } else {
          document.getElementById('hbButtonProps').style.display = 'none';
      }
    } else { document.getElementById('hbPropPanel').style.display = 'none'; document.getElementById('hbPropEmpty').style.display = 'block'; }
    
    if (rebuildList) {
      const list = document.getElementById('hbLayerList'); list.innerHTML = '';
      [...this.elements].reverse().forEach(item => {
        const div = document.createElement('div'); div.className = `layer-item ${this.selectedId === item.id ? 'active' : ''}`;
        let iconHtml = '', title = '';
        if (item.type === 'button') {
            iconHtml = `<div class="layer-icon" style="background:${item.btnColor}; color:${item.textColor}; border:1px solid var(--hairline);">A</div>`; title = `Tombol: ${item.text}`;
        } else { iconHtml = `<div class="layer-icon"><img src="${item.src}"></div>`; title = `Gambar / Aset`; }
        div.innerHTML = `<div style="display:flex; align-items:center; gap:14px;">${iconHtml}<span style="font-weight:700; font-size:13px;">${title}</span></div>`;
        div.onclick = () => { this.selectedId = item.id; this.updateUI(); }; list.appendChild(div);
      });
    }
    this.redraw();
  },
  updateProps() {
    const el = this.elements.find(e => e.id === this.selectedId); if (!el) return;
    el.x = parseFloat(document.getElementById('hbPropX').value) || 0; el.y = parseFloat(document.getElementById('hbPropY').value) || 0;
    el.w = parseFloat(document.getElementById('hbPropW').value) || 100; el.h = parseFloat(document.getElementById('hbPropH').value) || 100; 
    
    if(el.type === 'button') {
        el.text = document.getElementById('hbPropText').value;
        el.btnColor = document.getElementById('hbPropBtnColor').value;
        el.textColor = document.getElementById('hbPropTextColor').value;
    }
    this.redraw();
  },
  redraw() {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.canvasW, this.canvasH);
    ctx.fillStyle = document.getElementById('hbBgColor').value; ctx.fillRect(0, 0, this.canvasW, this.canvasH);
    
    this.elements.forEach(el => {
      if (el.type === 'image' && el.imgData) { 
          ctx.drawImage(el.imgData, el.x, el.y, el.w, el.h); 
      } 
      else if (el.type === 'button') {
          // Kapsul (Pill button)
          ctx.fillStyle = el.btnColor || '#111111';
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.w, el.h, Math.min(el.h/2, 200));
          ctx.fill();
          ctx.shadowBlur = 0; 
          
          // Teks Tombol (Display Font - Syne)
          ctx.fillStyle = el.textColor || '#ffffff';
          ctx.font = `800 ${Math.min(el.h * 0.45, 120)}px 'Syne', sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
          ctx.fillText(el.text || 'MULAI', el.x + el.w / 2, el.y + el.h / 2 + 4);
      }
      
      // Editor Selection Outline
      if (this.selectedId === el.id) {
        ctx.strokeStyle = 'var(--accent-magenta)'; ctx.lineWidth = 6; ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.fillStyle = 'var(--accent-magenta)'; ctx.beginPath(); ctx.arc(el.x + el.w, el.y + el.h, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⤡', el.x + el.w, el.y + el.h);
      }
    });
  }
};


/* ============================================================
   EVENTS & ADMIN LOGIC
   ============================================================ */
function initApp() {
  if (S.events.length === 0) { 
      const defaultEvent = { id: Date.now(), name: 'Sesi Foto Wedding' };
      S.events.push(defaultEvent); 
      S.selectedEventId = defaultEvent.id;
      localStorage.setItem('pb_events', JSON.stringify(S.events)); 
  } else if (!S.selectedEventId && S.events.length > 0) {
      S.selectedEventId = S.events[0].id;
  }
  renderEvents(); LB.init(); HB.init();
  refreshCameras(); 
}

/* FUNGSI KAMERA EXTERNAL / CAPTURE CARD */
async function refreshCameras() {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(device => device.kind === 'videoinput');
    
    const select = document.getElementById('cameraSelect');
    select.innerHTML = '';
    
    videoInputs.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Kamera ${select.length + 1}`;
      if (device.deviceId === S.selectedCameraId) option.selected = true;
      select.appendChild(option);
    });
    
    if (!S.selectedCameraId && videoInputs.length > 0) {
      S.selectedCameraId = videoInputs[0].deviceId;
    }
  } catch(err) {
    console.error("Gagal membaca daftar kamera", err);
  }
}

function saveCameraSelection() {
  const select = document.getElementById('cameraSelect');
  if (select.value) {
    S.selectedCameraId = select.value;
    localStorage.setItem('pb_camera_id', S.selectedCameraId);
    notify("Kamera berhasil disimpan!", "success");
  }
}

function renderEvents() {
  const list = document.getElementById('eventList'); if(!list) return;
  
  // Tampilkan semua event dalam bentuk grid
  list.innerHTML = S.events.map((ev, i) => {
    const bgColor = PASTEL_COLORS[i % PASTEL_COLORS.length];
    const isSelected = S.selectedEventId === ev.id;
    const outline = isSelected ? `border: 4px solid var(--primary); box-shadow: var(--shadow-hover);` : `border: 2px solid transparent; opacity: 0.6;`;
    
    // Label "Aktif" jika Event dipilih
    const activeLabel = isSelected ? `<div style="display:inline-block; background:var(--primary); color:white; padding:6px 14px; border-radius:12px; font-size:12px; font-weight:700; margin-bottom:16px;">✓ Aktif Saat Ini</div>` : '';
    const userFrameCount = window.FrameStore.getUserFrames(ev.id).length;
    
    return `
    <div style="padding:40px 32px; background:${bgColor}; border-radius:var(--radius-lg); cursor:pointer; transition:all 0.2s; position:relative; ${outline}" onclick="selectEvent(${ev.id})">
      
      <!-- Tombol Aksi Kanan Atas -->
      <div style="position:absolute; top:24px; right:24px; display:flex; gap:8px; z-index:10;">
         <button onclick="event.stopPropagation(); editEvent(${ev.id})" style="background:rgba(255,255,255,0.6); border:none; padding:8px 12px; border-radius:var(--radius-md); cursor:pointer; font-size:16px; transition:all 0.2s;" onmouseover="this.style.background='white';" onmouseout="this.style.background='rgba(255,255,255,0.6)';" title="Ganti Nama">✏️</button>
         <button onclick="event.stopPropagation(); deleteEvent(${ev.id})" style="background:rgba(255,255,255,0.6); border:none; padding:8px 12px; border-radius:var(--radius-md); cursor:pointer; font-size:16px; transition:all 0.2s;" onmouseover="this.style.background='white';" onmouseout="this.style.background='rgba(255,255,255,0.6)';" title="Hapus Event">🗑️</button>
      </div>

      ${activeLabel}
      <div class="display-xl" style="font-size:32px; margin-bottom:12px; line-height:1.1; padding-right:80px;">${ev.name}</div>
      <div class="eyebrow" style="color:var(--primary);">📸 ${userFrameCount} Frame Layout Dibuat</div>
    </div>
  `}).join('');
}

// FUNGSI GANTI EVENT (KLIK PADA BOX EVENT)
function selectEvent(id) {
    S.selectedEventId = id;
    renderEvents();
    
    // Otomatis refresh canvas/editor jika sedang buka menu Layout atau Home
    if(document.getElementById('screen-home').classList.contains('active')) { HB.loadFromEvent(); }
    if(document.getElementById('screen-layout').classList.contains('active')) { LB.resetCanvas(); } // Reset frame edit jika pindah event
    
    notify("Berhasil beralih Event!", "success");
}

function createNewEvent() { 
    showPrompt('Buat Event Baru', 'Ketik nama event photobooth (cth: Ulang Tahun Budi)...', function(name) {
        const newEvent = { id: Date.now(), name };
        S.events.unshift(newEvent); 
        S.selectedEventId = newEvent.id; 
        
        localStorage.setItem('pb_events', JSON.stringify(S.events)); 
        renderEvents(); 
        notify('Event baru berhasil dibuat & diaktifkan!', 'success'); 
    });
}

function editEvent(id) {
    const ev = S.events.find(e => e.id === id);
    if(!ev) return;
    showPrompt('Ganti Nama Event', 'Ketik nama baru...', function(newName) {
        ev.name = newName;
        localStorage.setItem('pb_events', JSON.stringify(S.events));
        renderEvents();
        notify('Nama event berhasil diperbarui!', 'success');
    }, ev.name);
}

function deleteEvent(id) {
    showConfirm("Hapus Event Ini?", "Apakah Anda yakin? Semua frame layout dan desain yang dibuat untuk event ini juga akan ikut terhapus permanen.", function() {
        S.events = S.events.filter(e => e.id !== id);
        S.savedFrames = S.savedFrames.filter(f => f.eventId !== id);
        
        localStorage.setItem('pb_events', JSON.stringify(S.events));
        localStorage.setItem('pb_frames', JSON.stringify(S.savedFrames));

        if(S.selectedEventId === id) { S.selectedEventId = S.events.length > 0 ? S.events[0].id : null; }
        
        renderEvents();
        notify("Event dan isinya berhasil dihapus!", "success");
    });
}

function saveFrameToEvent() {
  if(!S.selectedEventId) { notify("Pilih Event dulu di halaman Event!", "error"); return; }
  const hasZone = LB.elements.some(e => e.type === 'zone');
  if(!hasZone) { notify("Tambahkan minimal 1 Zona Foto!", "error"); return; }

  let defaultName = "Frame Baru";
  if(LB.editingFrameId) {
      const stored = JSON.parse(localStorage.getItem('pb_frames') || '[]');
      const existing = stored.find(f => String(f.id) === String(LB.editingFrameId));
      if(existing) defaultName = existing.name;
  }

  showPrompt("Simpan Frame Layout", "Ketik nama untuk frame layout ini...", function(name) {
    const elementsData = LB.elements.map(el => {
      if(el.type === 'image') return { id: el.id, type: el.type, x: el.x, y: el.y, w: el.w, h: el.h, src: el.src };
      return { id: el.id, type: el.type, x: el.x, y: el.y, w: el.w, h: el.h };
    });
    const config = { canvas: { w: LB.canvasW, h: LB.canvasH }, bgColor: document.getElementById('lbBgColor').value, elements: elementsData };
    LB.selectedId = null;
    LB.redraw();
    const preview = LB.canvas.toDataURL('image/jpeg', 0.5);

    const stored = JSON.parse(localStorage.getItem('pb_frames') || '[]');

    if(LB.editingFrameId) {
      const idx = stored.findIndex(f => String(f.id) === String(LB.editingFrameId));
      if(idx !== -1) {
        stored[idx] = { ...stored[idx], name, config, preview };
        localStorage.setItem('pb_frames', JSON.stringify(stored));
        S.savedFrames = stored;
        notify("Frame berhasil diperbarui!", "success");
      } else {
        const newFrame = { id: Date.now(), eventId: S.selectedEventId, name, config, preview };
        stored.push(newFrame);
        localStorage.setItem('pb_frames', JSON.stringify(stored));
        S.savedFrames = stored;
        LB.editingFrameId = newFrame.id;
        notify("Disimpan sebagai frame baru (frame bawaan tidak bisa diubah).", "success");
      }
    } else {
      const newFrame = { id: Date.now(), eventId: S.selectedEventId, name, config, preview };
      stored.push(newFrame);
      localStorage.setItem('pb_frames', JSON.stringify(stored));
      S.savedFrames = stored;
      LB.editingFrameId = newFrame.id;
      notify("Berhasil Menyimpan Layout Baru!", "success");
    }
    renderEvents();
  }, defaultName);
}

function showScreen(id) {
  if(S.kioskMode) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); document.getElementById('nav-' + id).classList.add('active');
  
  if(id === 'home') {
      if(!S.selectedEventId) { notify("Pilih Event dulu di menu Event!", "error"); showScreen('event'); return; }
      HB.loadFromEvent();
  }
}

/* ============================================================
   KIOSK ENGINE (ALL IN ONE CAPTURE)
   ============================================================ */
async function startKioskMode() {
  const frames = await window.FrameStore.getForEvent(S.selectedEventId);
  if(frames.length === 0) { notify("Silakan buat Frame Layout untuk event ini terlebih dahulu (di menu Layout)!", "error"); return; }
  
  S.kioskMode = true;
  
  document.getElementById('admin-ui').style.display = 'none';
  
  document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('kiosk-attract').classList.add('active');
  
  renderAttractScreen();
  lcvStartCamera();
}

async function renderAttractScreen() {
    const canvas = document.getElementById('attractRenderCanvas');
    const ctx = canvas.getContext('2d');
    const event = S.events.find(e => e.id === S.selectedEventId);
    
    if(event && event.homeScreen) {
        const config = event.homeScreen;
        canvas.width = config.canvas.w;
        canvas.height = config.canvas.h;
        ctx.fillStyle = config.bgColor;
        ctx.fillRect(0,0, canvas.width, canvas.height);
        
        for (const el of config.elements) {
            if(el.type === 'image' && el.src) {
                const img = await loadImg(el.src);
                if(img) ctx.drawImage(img, el.x, el.y, el.w, el.h);
            } else if (el.type === 'button') {
                ctx.fillStyle = el.btnColor || '#111111';
                ctx.beginPath();
                ctx.roundRect(el.x, el.y, el.w, el.h, Math.min(el.h/2, 200));
                ctx.fill();
                ctx.fillStyle = el.textColor || '#ffffff';
                ctx.font = `800 ${Math.min(el.h * 0.45, 120)}px 'Syne', sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
                ctx.fillText(el.text || 'MULAI', el.x + el.w / 2, el.y + el.h / 2 + 4);
            }
        }
    } else {
        canvas.width = 1080; canvas.height = 1920;
        ctx.fillStyle = '#fcead1'; ctx.fillRect(0,0, 1080, 1920);
        
        ctx.fillStyle = '#111111';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 130px 'Syne', sans-serif`;
        ctx.fillText('Tap to Start', 1080/2, 1920/2 - 120);
        
        ctx.font = `400 40px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillText('Sentuh layar untuk berfoto', 1080/2, 1920/2 + 40);
        
        ctx.fillStyle = '#111111';
        ctx.beginPath(); ctx.roundRect(1080/2 - 240, 1920/2 + 160, 480, 140, 70); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = `bold 40px 'Syne', sans-serif`;
        ctx.fillText('MULAI', 1080/2, 1920/2 + 235);
    }
}

async function kioskStart() {
  document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('kiosk-select').classList.add('active');
  
  const contentArea = document.getElementById('kioskContentArea');
  
  // Ambil FRAME untuk event ini (built-in + user)
  const frames = await window.FrameStore.getForEvent(S.selectedEventId);
  
  contentArea.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:32px;padding:20px;';

  for(const f of frames) {
    // Generate preview on-the-fly jika frame tidak punya preview (built-in)
    let previewSrc = f.preview || '';
    if(!previewSrc && f.config) {
      try {
        previewSrc = await composeEventLayout([], f.config);
      } catch(e) { previewSrc = ''; }
    }

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--secondary);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow);cursor:pointer;width:300px;text-align:center;transition:transform 0.2s;';
    card.innerHTML = `
      <img src="${previewSrc}" style="width:100%;border-radius:var(--radius-md);margin-bottom:24px;border:1px solid var(--hairline);background:var(--surface-soft);min-height:100px;">
      <div class="display-xl" style="font-size:24px;color:var(--primary);margin-bottom:16px;">${f.name}</div>
      <button class="btn primary" style="width:100%;padding:14px;">PILIH FRAME</button>
    `;
    card.onclick = () => startAllInOneSession(f.id);
    card.onmouseover = () => { card.style.transform='translateY(-8px)'; card.style.boxShadow='var(--shadow-hover)'; };
    card.onmouseout  = () => { card.style.transform='none'; card.style.boxShadow='var(--shadow)'; };
    wrapper.appendChild(card);
  }
  contentArea.appendChild(wrapper);
}

function exitKioskMode() {
  S.kioskMode = false;
  document.getElementById('admin-ui').style.display = 'flex';
  document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('liveCaptureView').classList.remove('show');
  if(S.stream) S.stream.getTracks().forEach(t=>t.stop());
}

async function startAllInOneSession(frameId) {
  S.selectedEventFrame = await window.FrameStore.findById(frameId);
  if(!S.selectedEventFrame || !S.selectedEventFrame.config) {
    notify("Frame tidak ditemukan, coba lagi.", "error");
    kioskStart(); return;
  }
  S.eventShots = [];
  document.getElementById('lcvThumbnails').innerHTML = ''; 
  document.getElementById('kiosk-select').classList.remove('active');
  document.getElementById('liveCaptureView').classList.add('show');
  
  await sleep(1000); 

  let bgChunks = [];
  let bgRecorder = null;
  try {
      bgRecorder = new MediaRecorder(S.stream, { mimeType: 'video/webm' });
      bgRecorder.ondataavailable = e => { if(e.data.size > 0) bgChunks.push(e.data); };
      bgRecorder.start();
      document.getElementById('lcvRecordingDot').style.display = 'block';
  } catch(e) { console.warn("Background Video Not Supported", e); }

  const shotsNeeded = S.selectedEventFrame.config.elements.filter(e => e.type === 'zone').length;
  // Fallback agar minimal sistem jalan walau frame tidak punya zona
  const loopCount = Math.max(1, shotsNeeded); 
  
  for(let i=0; i<loopCount; i++) {
    await lcvCountdown(3);
    const raw = lcvCaptureFrame();
    S.eventShots.push(raw);
    lcvShowFlash();
    
    const thumb = document.createElement('img');
    thumb.src = raw; thumb.className = 'lcv-thumb';
    document.getElementById('lcvThumbnails').appendChild(thumb);
    
    if (i < loopCount - 1) await sleep(1200);
  }

  if(bgRecorder && bgRecorder.state !== 'inactive') {
      bgRecorder.stop();
      document.getElementById('lcvRecordingDot').style.display = 'none';
      await new Promise(res => {
         bgRecorder.onstop = () => {
             const blob = new Blob(bgChunks, { type: 'video/webm' });
             S.btsVideoUrl = URL.createObjectURL(blob);
             res();
         };
      });
  }

  // Sembunyikan layar capture, tampilkan Layar Loading
  document.getElementById('liveCaptureView').classList.remove('show');
  document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('kiosk-loading').classList.add('active');
  
  await sleep(100);
  
  S.frameResultUrl = await composeEventLayout(S.eventShots, S.selectedEventFrame.config);
  S.gifVideoUrl = await generateSimulatedGIF(S.eventShots);

  document.getElementById('kiosk-loading').classList.remove('active');
  setupResultScreen();
}

function lcvCountdown(sec) {
  return new Promise(async resolve => {
    const el = document.getElementById('lcvCountdown'), numEl = document.getElementById('lcvCountNum');
    el.style.display = 'flex';
    for(let i=sec; i>=1; i--) { numEl.textContent = i; await sleep(1000); }
    numEl.textContent = '📸'; await sleep(300); el.style.display = 'none'; resolve();
  });
}

function lcvCaptureFrame() {
  const vid = document.getElementById('lcvVideo'), canvas = document.createElement('canvas');
  canvas.width = vid.videoWidth || 1280; canvas.height = vid.videoHeight || 720;
  const ctx = canvas.getContext('2d'); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(vid, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function lcvShowFlash() {
  const el = document.getElementById('lcvFlash'); el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 100);
}

function loadImg(src) { 
    return new Promise(res => { 
        if(!src) return res(null);
        const img = new Image(); 
        img.onload = () => res(img); 
        img.onerror = () => { console.warn("Gambar gagal diload, dilompati."); res(null); }; 
        img.src = src; 
    }); 
}

async function composeEventLayout(photos, config) {
  const canvas = document.createElement('canvas'); canvas.width = config.canvas.w; canvas.height = config.canvas.h;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = config.bgColor; ctx.fillRect(0,0, canvas.width, canvas.height);
  let zoneIndex = 0;
  for (const el of config.elements) {
    if (el.type === 'image' && el.src) {
      const img = await loadImg(el.src); if(img) ctx.drawImage(img, el.x, el.y, el.w, el.h);
    } else if (el.type === 'zone') {
      const photoData = photos[zoneIndex];
      if (photoData) {
        const img = await loadImg(photoData);
        if(img) {
          ctx.save(); ctx.beginPath(); ctx.roundRect(el.x, el.y, el.w, el.h, Math.min(20, el.w*0.1)); ctx.clip();
          const sr = img.width/img.height, dr = el.w/el.h; let sw, sh, sx, sy;
          if(sr > dr) { sh = img.height; sw = sh*dr; sx = (img.width-sw)/2; sy = 0; } else { sw = img.width; sh = sw/dr; sx = 0; sy = (img.height-sh)/2; }
          ctx.drawImage(img, sx, sy, sw, sh, el.x, el.y, el.w, el.h); ctx.restore();
        }
      } zoneIndex++;
    }
  } return canvas.toDataURL('image/jpeg', 0.95);
}

function generateSimulatedGIF(photos) {
  return new Promise(async resolve => {
      try {
          if(!photos || photos.length === 0) return resolve(null);
          
          const canvas = document.createElement('canvas');
          const sample = await loadImg(photos[0]);
          if(!sample) return resolve(null); 

          canvas.width = sample.width; canvas.height = sample.height;
          const ctx = canvas.getContext('2d');
          
          if(!canvas.captureStream) return resolve(null); 
          
          const stream = canvas.captureStream(30);
          const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
          const chunks = [];
          rec.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };
          rec.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
          rec.start();

          let seq = [...photos];
          if(photos.length > 1) { seq = [...photos, ...[...photos].reverse().slice(1,-1)]; }
          
          for(let loops=0; loops < 3; loops++) {
              for(let i=0; i<seq.length; i++) {
                  const frameImg = await loadImg(seq[i]);
                  if(frameImg) ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
                  await sleep(350); 
              }
          }
          rec.stop();
      } catch(e) { console.warn("Pembuatan GIF Gagal:", e); resolve(null); }
  });
}

function setupResultScreen() {
    // 1. Siapkan QR Code Simulasi
    // QR Code — menggunakan library offline (qrcode.min.js)
    const uniqueId = Math.random().toString(36).substring(7);
    const localUrl = `photobooth://hasil/${uniqueId}`;
    const qrImg = document.getElementById('qrCodeImg');
    if (window.QRCode) {
        // Pakai library qrcode.min.js (davidshimjs)
        qrImg.src = '';
        const tempDiv = document.createElement('div');
        new QRCode(tempDiv, { text: localUrl, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
        setTimeout(() => {
            const canvas = tempDiv.querySelector('canvas');
            if (canvas) qrImg.src = canvas.toDataURL('image/png');
        }, 100);
    } else {
        // Fallback: sembunyikan QR jika library tidak ada
        qrImg.src = '';
        document.getElementById('qrSimContainer').style.display = 'none';
    }
    
    switchResultTab('frame');
    document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('kiosk-attract').classList.add('active'); 
    document.getElementById('resultOverlay').classList.add('active'); 
}

function switchResultTab(tabId) {
    S.activeResultTab = tabId;
    document.querySelectorAll('.media-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-res-' + tabId).classList.add('active');
    
    const imgDisplay = document.getElementById('resDisplayImg');
    const vidDisplay = document.getElementById('resDisplayVid');
    const rawGrid = document.getElementById('resDisplayRawGrid');
    
    imgDisplay.style.display = 'none'; vidDisplay.style.display = 'none'; rawGrid.style.display = 'none'; vidDisplay.pause();
    const printBtn = document.getElementById('btn-print-result');
    printBtn.style.opacity = '1'; printBtn.style.pointerEvents = 'auto'; 
    
    if(tabId === 'frame') { imgDisplay.src = S.frameResultUrl; imgDisplay.style.display = 'block'; } 
    else if (tabId === 'raw') {
        rawGrid.innerHTML = S.eventShots.map(src => `<img src="${src}">`).join('');
        rawGrid.style.display = 'grid'; printBtn.style.opacity = '0.5'; printBtn.style.pointerEvents = 'none'; 
    }
    else if (tabId === 'gif') {
        if(S.gifVideoUrl) { vidDisplay.src = S.gifVideoUrl; vidDisplay.style.display = 'block'; vidDisplay.play(); } 
        else { notify("Perangkat ini tidak mendukung pembuatan GIF otomatis.", "info"); switchResultTab('frame'); }
        printBtn.style.opacity = '0.5'; printBtn.style.pointerEvents = 'none';
    }
    else if (tabId === 'vid') {
        if(S.btsVideoUrl) { vidDisplay.src = S.btsVideoUrl; vidDisplay.style.display = 'block'; vidDisplay.play(); } 
        else { notify("Video BTS tidak tersedia.", "info"); switchResultTab('frame'); }
        printBtn.style.opacity = '0.5'; printBtn.style.pointerEvents = 'none';
    }
}

function downloadMedia() {
    let url = ''; let ext = 'jpg';
    if (S.activeResultTab === 'frame') { url = S.frameResultUrl; }
    else if (S.activeResultTab === 'raw') {
        S.eventShots.forEach((u, i) => { const a = document.createElement('a'); a.href = u; a.download = `Raw_${Date.now()}_${i}.jpg`; a.click(); });
        notify("Semua foto asli di-download!", "success"); return;
    } 
    else if (S.activeResultTab === 'gif') { url = S.gifVideoUrl; ext = 'webm'; }
    else if (S.activeResultTab === 'vid') { url = S.btsVideoUrl; ext = 'webm'; }

    const a = document.createElement('a'); a.href = url; a.download = `PhotoBooth_${Date.now()}.${ext}`; a.click(); notify("Disimpan ke Galeri HP!", "success");
}

function printMedia() {
    if (S.activeResultTab !== 'frame') return;
    notify("Menyiapkan dokumen printer...", "info");
    let printFrame = document.getElementById('printFrame');
    if(!printFrame) {
        printFrame = document.createElement('iframe'); printFrame.id = 'printFrame';
        printFrame.style.position = 'fixed'; printFrame.style.right = '0'; printFrame.style.bottom = '0';
        printFrame.style.width = '0'; printFrame.style.height = '0'; printFrame.style.border = 'none';
        document.body.appendChild(printFrame);
    }
    const frameDoc = printFrame.contentWindow.document; frameDoc.open();
    frameDoc.write(`<html><head><style>@page { margin: 0; } body { margin: 0; padding: 0; background: #fff; display: flex; justify-content: center; align-items: center; width: 100vw; height: 100vh; overflow: hidden; } img { max-width: 100%; max-height: 100%; object-fit: contain; }</style></head><body><img src="${S.frameResultUrl}" onload="setTimeout(() => { window.print(); }, 800);"></body></html>`);
    frameDoc.close();
}

function kioskFinish() {
  document.getElementById('resultOverlay').classList.remove('active');
  document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('kiosk-attract').classList.add('active');
}

async function lcvStartCamera() {
  try {
    let videoConstraints = { facingMode: 'user', width: { ideal: 1920 } };
    if (S.selectedCameraId) { videoConstraints = { deviceId: { exact: S.selectedCameraId }, width: { ideal: 1920 } }; }
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    S.stream = stream; document.getElementById('lcvVideo').srcObject = stream;
  } catch(e) { 
    console.warn("Kamera exact gagal, fallback ke kamera default", e);
    try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        S.stream = fallbackStream; document.getElementById('lcvVideo').srcObject = fallbackStream;
    } catch(err) { notify("Gagal menyalakan kamera. Pastikan browser diizinkan mengakses kamera!", "error"); }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.addEventListener('load', initApp);