(function (window) {
  'use strict';

  const DEFAULT_FIREBASE_URL = 'https://nqd-map2-default-rtdb.firebaseio.com';

  const AdminConfig = {
    passwords: {
      FA: 'Phucdeptrai367',
      AL: 'nqdlite'
    },
    alPermissions: {
      createBooth: true,
      moveResize: true,
      editContent: true,
      editTags: true,
      editShapeVertex: true,
      editTypography: true,
      editTooltip: true
    },
    unlockOriginMap: false,
    dragEnabled: true,
    firebaseUrl: DEFAULT_FIREBASE_URL
  };

  function getMap() { return window.NQDMap; }
  function getState() { return window.NQDMap ? window.NQDMap.state : null; }

  function loadAdminSettings() {
    const st = getState();
    if (!st) return;
    if (st.adminConfig) {
      Object.assign(AdminConfig.passwords, st.adminConfig.passwords || {});
      Object.assign(AdminConfig.alPermissions, st.adminConfig.alPermissions || {});
      if (st.adminConfig.firebaseUrl) AdminConfig.firebaseUrl = st.adminConfig.firebaseUrl;
    } else {
      st.adminConfig = JSON.parse(JSON.stringify(AdminConfig));
    }
  }

  function syncAdminSettingsToState() {
    const st = getState();
    if (!st) return;
    st.adminConfig = {
      passwords: Object.assign({}, AdminConfig.passwords),
      alPermissions: Object.assign({}, AdminConfig.alPermissions),
      firebaseUrl: AdminConfig.firebaseUrl
    };
    getMap().saveStorage();
  }

  
  const undoStack = [];
  const MAX_UNDO = 30;

  function pushUndoSnapshot() {
    const sheet = getMap().getActiveSheet();
    if (!sheet) return;
    undoStack.push({
      sheetId: sheet.id,
      rooms: JSON.parse(JSON.stringify(sheet.rooms))
    });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    updateUndoButtonUI();
  }

  function performUndo() {
    const st = getState();
    if (!st || st.adminRole === 'NONE') return;
    if (undoStack.length === 0) {
      notify('Không còn thao tác nào để hoàn tác.');
      return;
    }
    const snap = undoStack.pop();
    const targetSheet = st.sheets.find(s => s.id === snap.sheetId);
    if (targetSheet) {
      targetSheet.rooms = snap.rooms;
      getMap().saveStorage();
      getMap().render();
      refreshInspectorPanel();
      renderVertexHandlesOnMap();
      notify('↩️ Đã hoàn tác thao tác vừa rồi (Ctrl+Z)');
    }
    updateUndoButtonUI();
  }

  function updateUndoButtonUI() {
    const btn = document.getElementById('btn-admin-undo');
    if (!btn) return;
    btn.disabled = undoStack.length === 0;
    btn.textContent = undoStack.length > 0 ? `↩️ Hoàn tác (${undoStack.length})` : '↩️ Hoàn tác';
    btn.className = undoStack.length > 0
      ? 'px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow'
      : 'px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 text-xs font-bold cursor-not-allowed';
  }

  function notify(text) {
    const el = document.getElementById('admin-toast');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(window.__admToastTimer);
    window.__admToastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function canEditRoom(room, actionType) {
    const st = getState();
    if (!st || st.adminRole === 'NONE' || !room) return false;
    if (room.locked) return false;

    const sheet = getMap().getActiveSheet();
    if (sheet.lockedOrigin && !AdminConfig.unlockOriginMap) return false;
    if (st.adminRole === 'FA') return true;

    if (st.adminRole === 'AL') {
      if (sheet.lockedOrigin) return false;
      const p = AdminConfig.alPermissions;
      if (actionType === 'moveResize') return !!p.moveResize;
      if (actionType === 'shape') return !!p.editShapeVertex;
      if (actionType === 'typography') return !!p.editTypography;
      if (actionType === 'content') return !!p.editContent;
      if (actionType === 'tags') return !!p.editTags;
      if (actionType === 'tooltip') return !!p.editTooltip;
      return true;
    }
    return false;
  }

  function getSelectedEditableRooms(actionType) {
    const st = getState();
    const sheet = getMap().getActiveSheet();
    if (!st || !sheet) return [];
    const ids = st.multiSelectedIds.length > 0
      ? st.multiSelectedIds
      : (st.selectedRoomId ? [st.selectedRoomId] : []);
    return sheet.rooms.filter(r => ids.includes(r.id) && canEditRoom(r, actionType));
  }

  function updateAdminWorkspaceUI() {
    const st = getState();
    if (!st) return;

    const panel = document.getElementById('admin-studio-aside');
    const sheetBar = document.getElementById('admin-sheet-bar');
    const world = document.getElementById('map-world');
    const entryBtn = document.getElementById('btn-admin-login-toggle');
    const roleBadge = document.getElementById('admin-role-badge');

    if (st.adminRole === 'NONE') {
      panel.classList.add('hidden');
      panel.classList.remove('flex');
      sheetBar.classList.add('hidden');
      sheetBar.classList.remove('flex');
      world.classList.remove('admin-grid-overlay');
      entryBtn.innerHTML = '<span>🔒</span><span>Admin</span>';
      entryBtn.className = 'px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 transition';
      if (window.NQDStreetView) window.NQDStreetView.setAdminTabActive(false);
      getMap().render();
      return;
    }

    panel.classList.remove('hidden');
    panel.classList.add('flex');
    sheetBar.classList.remove('hidden');
    sheetBar.classList.add('flex');
    if (st.snapToGrid) {
      world.classList.add('admin-grid-overlay');
    } else {
      world.classList.remove('admin-grid-overlay');
    }

    const isFA = st.adminRole === 'FA';
    entryBtn.innerHTML = isFA ? '<span>👑</span><span>Thoát FA</span>' : '<span>🎨</span><span>Thoát AL</span>';
    entryBtn.className = 'px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 transition shadow';
    roleBadge.textContent = isFA ? '👑 FULL ADMIN' : '🎨 ADMIN LITE';
    roleBadge.className = isFA
      ? 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold'
      : 'px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[11px] font-bold';

    document.querySelectorAll('.fa-only-tab').forEach(t => t.classList.toggle('hidden', !isFA));
    document.getElementById('wrap-unlock-origin').classList.toggle('hidden', !isFA);
    document.getElementById('btn-create-event-sheet').classList.toggle('hidden', !isFA);

    renderSheetBar();
    refreshInspectorPanel();
    renderVertexHandlesOnMap();
  }

  function renderSheetBar() {
    const st = getState();
    const container = document.getElementById('sheet-tabs-list');
    const curSheetLabel = document.getElementById('admin-current-sheet-name');
    if (!st || !container) return;

    const activeSheet = getMap().getActiveSheet();
    curSheetLabel.textContent = activeSheet.name;

    container.innerHTML = '';
    st.sheets.forEach(sh => {
      const isAct = sh.id === st.activeSheetId;
      const isPub = sh.id === st.publicSheetId;

      const wrap = document.createElement('div');
      wrap.className = `flex items-center rounded-lg border text-xs font-bold transition overflow-hidden shrink-0 ${
        isAct ? 'bg-sky-600 text-white border-sky-400 shadow' : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
      }`;

      const btn = document.createElement('button');
      btn.className = 'px-3 py-1 flex items-center gap-1.5';
      btn.innerHTML = `<span>${sh.name}</span>${
        isPub ? '<span class="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold">PUBLIC</span>' : ''
      }`;
      btn.addEventListener('click', () => {
        st.activeSheetId = sh.id;
        st.selectedRoomId = null;
        st.multiSelectedIds = [];
        getMap().render();
        renderSheetBar();
        refreshInspectorPanel();
      });
      wrap.appendChild(btn);

      if (st.adminRole === 'FA') {
        if (!isPub) {
          const pubBtn = document.createElement('button');
          pubBtn.className = 'px-1.5 py-1 bg-slate-950/40 hover:bg-emerald-500 hover:text-slate-950 text-[10px] transition';
          pubBtn.title = 'Đặt Public';
          pubBtn.textContent = '🌐';
          pubBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            st.publicSheetId = sh.id;
            getMap().saveStorage();
            renderSheetBar();
            notify(`🌐 Đã đặt "${sh.name}" làm bản đồ Public.`);
          });
          wrap.appendChild(pubBtn);
        }
        if (!sh.lockedOrigin) {
          const delBtn = document.createElement('button');
          delBtn.className = 'px-1.5 py-1 bg-slate-950/40 hover:bg-rose-600 text-slate-300 hover:text-white text-[10px] transition';
          delBtn.textContent = '✖';
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            st.sheets = st.sheets.filter(x => x.id !== sh.id);
            if (st.publicSheetId === sh.id) st.publicSheetId = 'sheet_origin';
            if (st.activeSheetId === sh.id) st.activeSheetId = 'sheet_origin';
            getMap().render();
            renderSheetBar();
          });
          wrap.appendChild(delBtn);
        }
      }
      container.appendChild(wrap);
    });
  }

  function onRoomPointerDown(e, room) {
    const st = getState();
    if (!st || st.adminRole === 'NONE') return;

    refreshInspectorPanel();
    renderVertexHandlesOnMap();

    if (!AdminConfig.dragEnabled || e.button !== 0) return;
    if (!canEditRoom(room, 'moveResize')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const targets = getSelectedEditableRooms('moveResize');
    if (targets.length === 0) return;

    const startPositions = targets.map(r => ({ room: r, x: r.x, y: r.y }));
    let hasMoved = false;

    function onMove(ev) {
      const dx = (ev.clientX - startX) / st.zoom;
      const dy = (ev.clientY - startY) / st.zoom;
      if (!hasMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        hasMoved = true;
        pushUndoSnapshot();
      }
      if (!hasMoved) return;

      startPositions.forEach(item => {
        let nx = item.x + dx;
        let ny = item.y + dy;
        if (st.snapToGrid) {
          nx = Math.round(nx / 10) * 10;
          ny = Math.round(ny / 10) * 10;
        } else {
          nx = Math.round(nx);
          ny = Math.round(ny);
        }
        item.room.x = Math.max(10, Math.min(st.worldWidth - item.room.w - 10, nx));
        item.room.y = Math.max(10, Math.min(st.worldHeight - item.room.h - 10, ny));
      });

      getMap().renderRooms();
      refreshInspectorCoordsOnly();
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (hasMoved) getMap().saveStorage();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function renderVertexHandlesOnMap() {
    document.querySelectorAll('.admin-vertex-handle, .admin-resize-handle').forEach(h => h.remove());

    const st = getState();
    if (!st || st.adminRole === 'NONE' || !st.selectedRoomId) return;

    const sheet = getMap().getActiveSheet();
    const room = sheet.rooms.find(r => r.id === st.selectedRoomId);
    if (!room || room.locked) return;

    const layer = document.getElementById('rooms-layer');
    if (!layer) return;

    if (canEditRoom(room, 'moveResize')) {
      const rz = document.createElement('div');
      rz.className = 'admin-resize-handle absolute w-3.5 h-3.5 rounded-sm bg-sky-400 border-2 border-slate-950 shadow cursor-nwse-resize z-40';
      rz.style.left = (room.x + room.w - 7) + 'px';
      rz.style.top = (room.y + room.h - 7) + 'px';
      rz.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const sx = e.clientX;
        const sy = e.clientY;
        const ow = room.w;
        const oh = room.h;
        pushUndoSnapshot();

        function onMove(ev) {
          let nw = ow + (ev.clientX - sx) / st.zoom;
          let nh = oh + (ev.clientY - sy) / st.zoom;
          if (st.snapToGrid) {
            nw = Math.round(nw / 10) * 10;
            nh = Math.round(nh / 10) * 10;
          }
          room.w = Math.max(24, Math.round(nw));
          room.h = Math.max(24, Math.round(nh));
          getMap().renderRooms();
          refreshInspectorCoordsOnly();
        }
        function onUp() {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          getMap().saveStorage();
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      layer.appendChild(rz);
    }

    if (st.vertexEditMode && canEditRoom(room, 'shape')) {
      const pts = getMap().parsePolygonPoints(room.polygon);
      pts.forEach((pt, idx) => {
        const vh = document.createElement('div');
        vh.className = 'admin-vertex-handle absolute w-4 h-4 rounded-full bg-fuchsia-500 border-2 border-white shadow-lg cursor-move z-40 flex items-center justify-center text-[8px] font-bold text-white';
        const px = room.x + (pt.x / 100) * room.w;
        const py = room.y + (pt.y / 100) * room.h;
        vh.style.left = (px - 8) + 'px';
        vh.style.top = (py - 8) + 'px';
        vh.textContent = idx + 1;

        vh.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          const sx = e.clientX;
          const sy = e.clientY;
          const ox = pt.x;
          const oy = pt.y;
          pushUndoSnapshot();

          function onMove(ev) {
            const dx = (ev.clientX - sx) / st.zoom;
            const dy = (ev.clientY - sy) / st.zoom;
            pt.x = Math.max(0, Math.min(100, Math.round(ox + (dx / room.w) * 100)));
            pt.y = Math.max(0, Math.min(100, Math.round(oy + (dy / room.h) * 100)));
            room.shape = 'custom';
            room.polygon = pts.map(p => `${p.x} ${p.y}`).join(', ');
            document.getElementById('adm-polygon-points').value = room.polygon;
            getMap().renderRooms();
          }
          function onUp() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            getMap().saveStorage();
          }
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
        layer.appendChild(vh);
      });
    }
  }

  function refreshInspectorCoordsOnly() {
    const st = getState();
    const sheet = getMap().getActiveSheet();
    const room = sheet.rooms.find(r => r.id === st.selectedRoomId);
    if (!room) return;
    document.getElementById('adm-x').value = Math.round(room.x);
    document.getElementById('adm-y').value = Math.round(room.y);
    document.getElementById('adm-w').value = Math.round(room.w);
    document.getElementById('adm-h').value = Math.round(room.h);
  }

  function refreshInspectorPanel() {
    const st = getState();
    if (!st || st.adminRole === 'NONE') return;

    const sheet = getMap().getActiveSheet();
    const room = sheet.rooms.find(r => r.id === st.selectedRoomId) || sheet.rooms[3];
    if (!room) return;

    const countBadge = document.getElementById('adm-selection-count');
    const cnt = Math.max(1, st.multiSelectedIds.length);
    countBadge.textContent = cnt > 1 ? `Đa chọn: ${cnt} ô` : room.name;

    const lockedAlert = document.getElementById('adm-locked-axis-badge');
    const editorBody = document.getElementById('adm-inspector-body');
    const isOriginLocked = sheet.lockedOrigin && !AdminConfig.unlockOriginMap;

    if (room.locked || isOriginLocked) {
      lockedAlert.classList.remove('hidden');
      lockedAlert.textContent = room.locked ? '🔒 Trục Trung Tâm Bất Biến' : '🔒 Map Gốc Đang Khóa';
      editorBody.classList.add('opacity-40', 'pointer-events-none');
    } else {
      lockedAlert.classList.add('hidden');
      editorBody.classList.remove('opacity-40', 'pointer-events-none');
    }

    document.getElementById('adm-name').value = room.name || '';
    document.getElementById('adm-floor').value = room.floor || 'TRET';
    document.getElementById('adm-category').value = room.category || 'LOPHOC';
    document.getElementById('adm-repair').checked = !!room.repairMode;
    document.getElementById('adm-x').value = Math.round(room.x);
    document.getElementById('adm-y').value = Math.round(room.y);
    document.getElementById('adm-w').value = Math.round(room.w);
    document.getElementById('adm-h').value = Math.round(room.h);
    document.getElementById('adm-color').value = room.color || '#4dd0e1';
    document.getElementById('adm-text-color').value = room.textColor || '#0f172a';
    document.getElementById('adm-fontsize').value = room.fontSize || 13;
    document.getElementById('lbl-adm-fontsize').textContent = (room.fontSize || 13) + 'px';
    document.getElementById('adm-angle').value = room.angle || 0;
    document.getElementById('lbl-adm-angle').textContent = (room.angle || 0) + '°';
    document.getElementById('adm-font-url').value = room.fontUrl || '';
    document.getElementById('adm-font-family').value = room.fontFamily || '';
    document.getElementById('adm-polygon-points').value = room.polygon || '';
    document.getElementById('adm-tip-emoji').value = room.tooltipEmoji || '✨';
    document.getElementById('adm-tip-bg').value = room.tooltipBg || '#ffffff';
    document.getElementById('adm-tip-text').value = room.tooltipText || '';
    document.getElementById('adm-img-url').value = room.img || '';
    document.getElementById('adm-desc').value = room.desc || '';
    document.getElementById('adm-interior-public').checked = !!room.interiorPublic;
    document.getElementById('lbl-interior-count').textContent = (room.subBooths || []).length;

    document.querySelectorAll('.adm-shape-btn').forEach(b => {
      const on = (room.shape || 'rect') === b.dataset.shape;
      b.className = `adm-shape-btn py-1 rounded text-[11px] font-bold transition ${
        on ? 'bg-sky-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
      }`;
    });

    const tagsGrid = document.getElementById('adm-room-tags-box');
    tagsGrid.innerHTML = '';
    st.eventTags.forEach(tag => {
      const checked = Array.isArray(room.tags) && room.tags.includes(tag.id);
      const btn = document.createElement('button');
      btn.className = `px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
        checked ? 'bg-amber-400 text-slate-950 shadow' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
      }`;
      btn.innerHTML = `<span>${tag.icon}</span><span>${tag.label}</span>`;
      btn.addEventListener('click', () => {
        getSelectedEditableRooms('tags').forEach(r => {
          r.tags = r.tags || [];
          if (r.tags.includes(tag.id)) {
            r.tags = r.tags.filter(x => x !== tag.id);
          } else {
            r.tags.push(tag.id);
          }
        });
        getMap().render();
        refreshInspectorPanel();
      });
      tagsGrid.appendChild(btn);
    });
  }

  function openInteriorDesignerModal() {
    const st = getState();
    const sheet = getMap().getActiveSheet();
    const room = sheet.rooms.find(r => r.id === st.selectedRoomId);
    if (!room || !canEditRoom(room, 'content')) return;

    const modal = document.getElementById('admin-interior-designer-modal');
    document.getElementById('adm-int-modal-title').textContent = `🏛️ Nội thất: ${room.name}`;
    renderInteriorDesignerCanvas(room);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function renderInteriorDesignerCanvas(room) {
    const canvas = document.getElementById('adm-int-designer-canvas');
    const list = document.getElementById('adm-int-subbooths-list');
    canvas.innerHTML = '';
    list.innerHTML = '';

    room.subBooths = room.subBooths || [];
    room.subBooths.forEach(sb => {
      const box = document.createElement('div');
      box.style.left = sb.rx + '%';
      box.style.top = sb.ry + '%';
      box.style.width = sb.rw + '%';
      box.style.height = sb.rh + '%';
      box.style.backgroundColor = sb.color || '#f59e0b';
      box.className = 'absolute rounded-lg border-2 border-white text-white font-bold text-xs flex items-center justify-center text-center p-1 shadow-md cursor-move';
      box.textContent = sb.name;

      box.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX;
        const sy = e.clientY;
        const orx = sb.rx;
        const ory = sb.ry;

        function onMove(ev) {
          const dxPct = ((ev.clientX - sx) / rect.width) * 100;
          const dyPct = ((ev.clientY - sy) / rect.height) * 100;
          sb.rx = Math.max(0, Math.min(100 - sb.rw, Math.round(orx + dxPct)));
          sb.ry = Math.max(0, Math.min(100 - sb.rh, Math.round(ory + dyPct)));
          box.style.left = sb.rx + '%';
          box.style.top = sb.ry + '%';
          getMap().renderRooms();
        }
        function onUp() {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          getMap().saveStorage();
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      canvas.appendChild(box);

      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs';
      row.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <input type="color" value="${sb.color || '#f59e0b'}" class="sb-color-in w-4 h-4 rounded border-0 bg-transparent p-0 cursor-pointer" />
          <span class="font-bold truncate">${sb.name}</span>
        </div>
        <button class="sb-del-btn text-rose-400 hover:text-rose-300 font-bold">✖</button>
      `;
      row.querySelector('.sb-color-in').addEventListener('input', (e) => {
        sb.color = e.target.value;
        renderInteriorDesignerCanvas(room);
        getMap().renderRooms();
      });
      row.querySelector('.sb-del-btn').addEventListener('click', () => {
        room.subBooths = room.subBooths.filter(x => x.id !== sb.id);
        renderInteriorDesignerCanvas(room);
        getMap().renderRooms();
        refreshInspectorPanel();
      });
      list.appendChild(row);
    });
  }

  function refreshHeaderAndTagsTab() {
    const st = getState();
    if (!st) return;
    const hc = st.headerConfig;

    document.getElementById('adm-ev-active').checked = !!hc.eventActive;
    document.getElementById('adm-ev-title').value = hc.eventTitle || '';
    document.getElementById('adm-ev-date').value = hc.eventDate || '';
    document.getElementById('adm-ev-font-link').value = hc.fontLink || '';
    document.getElementById('adm-ev-font-name').value = hc.fontName || '';

    const logosBox = document.getElementById('adm-logos-list');
    logosBox.innerHTML = '';
    (hc.logos || []).forEach((lg, idx) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs';
      row.innerHTML = `
        <input type="text" value="${lg.short || ''}" placeholder="Viết tắt" class="lg-short w-14 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-amber-300 font-bold text-center" />
        <input type="text" value="${lg.img || ''}" placeholder="URL Ảnh Logo" class="lg-img flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-white" />
        <label class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] cursor-pointer">📁<input type="file" accept="image/*" class="lg-file hidden" /></label>
        ${idx > 0 ? '<button class="lg-del px-1.5 text-rose-400 font-bold">✖</button>' : ''}
      `;
      row.querySelector('.lg-short').addEventListener('input', (e) => {
        lg.short = e.target.value;
        getMap().render();
      });
      row.querySelector('.lg-img').addEventListener('input', (e) => {
        lg.img = e.target.value;
        getMap().render();
      });
      row.querySelector('.lg-file').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          lg.img = r.result;
          refreshHeaderAndTagsTab();
          getMap().render();
        };
        r.readAsDataURL(f);
      });
      const delBtn = row.querySelector('.lg-del');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          hc.logos.splice(idx, 1);
          refreshHeaderAndTagsTab();
          getMap().render();
        });
      }
      logosBox.appendChild(row);
    });

    const tagsBox = document.getElementById('adm-event-tags-manager');
    tagsBox.innerHTML = '';
    st.eventTags.forEach((tag, idx) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs';
      row.innerHTML = `
        <input type="text" value="${tag.icon}" class="tg-icon w-9 py-1 rounded bg-slate-900 border border-slate-800 text-center" />
        <input type="text" value="${tag.label}" class="tg-lbl flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-white" />
        <button class="tg-del px-2 text-rose-400 font-bold">✖</button>
      `;
      row.querySelector('.tg-icon').addEventListener('input', (e) => {
        tag.icon = e.target.value;
        getMap().render();
      });
      row.querySelector('.tg-lbl').addEventListener('input', (e) => {
        tag.label = e.target.value;
        getMap().render();
      });
      row.querySelector('.tg-del').addEventListener('click', () => {
        st.eventTags.splice(idx, 1);
        refreshHeaderAndTagsTab();
        refreshInspectorPanel();
        getMap().render();
      });
      tagsBox.appendChild(row);
    });

    const spBox = document.getElementById('adm-sponsors-manager');
    spBox.innerHTML = '';
    st.sponsors.forEach((sp, idx) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs';
      row.innerHTML = `
        <span class="truncate"><b class="text-amber-300">[${sp.tier}]</b> ${sp.name}</span>
        <button class="sp-del text-rose-400 font-bold">✖</button>
      `;
      row.querySelector('.sp-del').addEventListener('click', () => {
        st.sponsors.splice(idx, 1);
        refreshHeaderAndTagsTab();
        getMap().render();
        getMap().saveStorage();
      });
      spBox.appendChild(row);
    });

    const sheet = getMap().getActiveSheet();
    const flFrom = document.getElementById('adm-fl-from');
    const flTo = document.getElementById('adm-fl-to');
    flFrom.innerHTML = '';
    flTo.innerHTML = '';
    sheet.rooms.forEach(r => {
      flFrom.add(new Option(r.name, r.id));
      flTo.add(new Option(r.name, r.id));
    });

    const flList = document.getElementById('adm-fixed-lines-manager');
    flList.innerHTML = '';
    (sheet.fixedLines || []).forEach((fl, idx) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs';
      row.innerHTML = `
        <span class="truncate text-emerald-300 font-semibold">${fl.label} (${fl.from} ➔ ${fl.to})</span>
        <button class="fl-del text-rose-400 font-bold">✖</button>
      `;
      row.querySelector('.fl-del').addEventListener('click', () => {
        sheet.fixedLines.splice(idx, 1);
        refreshHeaderAndTagsTab();
        getMap().render();
      });
      flList.appendChild(row);
    });
  }

  function normalizeFirebaseUrl(u) {
    if (!u) return DEFAULT_FIREBASE_URL;
    u = u.trim();
    const m = u.match(/database\/([a-zA-Z0-9-]+)\/data/);
    if (m && m[1]) return 'https://' + m[1] + '.firebaseio.com';
    return u.replace(/\/~2F.*$/, '').replace(/\.json$/, '').replace(/\/$/, '');
  }

  function sanitizeCloudState(data) {
    if (!data || typeof data !== 'object') return null;
    if (!Array.isArray(data.sheets) || data.sheets.length === 0) return null;
    data.sponsors = Array.isArray(data.sponsors) ? data.sponsors : [];
    data.eventTags = Array.isArray(data.eventTags) ? data.eventTags : [];
    data.streetViewNodes = Array.isArray(data.streetViewNodes) ? data.streetViewNodes : [];
    data.streetViewNodes.forEach(n => {
      n.arrows = Array.isArray(n.arrows) ? n.arrows : [];
    });
    data.sheets.forEach(sh => {
      sh.rooms = Array.isArray(sh.rooms) ? sh.rooms : [];
      sh.fixedLines = Array.isArray(sh.fixedLines) ? sh.fixedLines : [];
      sh.rooms.forEach(r => {
        r.tags = Array.isArray(r.tags) ? r.tags : [];
        if (r.subBooths && !Array.isArray(r.subBooths)) r.subBooths = Object.values(r.subBooths);
      });
    });
    return data;
  }

  async function fetchFirebaseWithFallback(baseUrl, options) {
    const clean = normalizeFirebaseUrl(baseUrl);
    const candidates = [clean];
    const m = clean.match(/^https:\/\/([a-zA-Z0-9-]+)\.firebaseio\.com$/);
    if (m && m[1]) {
      candidates.push('https://' + m[1] + '.asia-southeast1.firebasedatabase.app');
      candidates.push('https://' + m[1] + '.europe-west1.firebasedatabase.app');
    }
    let lastStatus = 0;
    let lastErr = '';
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await fetch(candidates[i] + '/nqd_campus_v2.json?t=' + Date.now(), options);
        if (res.ok) {
          AdminConfig.firebaseUrl = candidates[i];
          const urlIn = document.getElementById('adm-firebase-url');
          if (urlIn) urlIn.value = candidates[i];
          return res;
        }
        lastStatus = res.status;
        lastErr = 'HTTP ' + res.status;
      } catch (err) {
        lastErr = err.message || 'Network/CORS error';
      }
    }
    const e = new Error(lastErr || 'Firebase unreachable');
    e.status = lastStatus;
    throw e;
  }

  async function pushToFirebaseCloud() {
    const st = getState();
    const statusEl = document.getElementById('adm-cloud-status');
    const rawUrl = (document.getElementById('adm-firebase-url')?.value || AdminConfig.firebaseUrl || '').trim();
    AdminConfig.firebaseUrl = normalizeFirebaseUrl(rawUrl || DEFAULT_FIREBASE_URL);
    const urlIn = document.getElementById('adm-firebase-url');
    if (urlIn) urlIn.value = AdminConfig.firebaseUrl;
    syncAdminSettingsToState();

    // Chuẩn bị bản sao sạch để đẩy lên Cloud (giữ toàn bộ sheets, rooms, streetViewNodes, headerConfig, sponsors, eventTags, seasonalEffect)
    const payload = JSON.parse(JSON.stringify(st));
    payload.adminRole = 'NONE';
    payload.selectedRoomId = null;
    payload.multiSelectedIds = [];
    payload.vertexEditMode = false;
    payload.updatedAt = Date.now();
    // Không đẩy ảnh blob:// tạm của máy tính lên Cloud
    if (Array.isArray(payload.streetViewNodes)) {
      payload.streetViewNodes.forEach(n => {
        if (n.img && n.img.startsWith('blob:')) n.img = '';
      });
    }

    if (statusEl) statusEl.textContent = '⏳ Đang đẩy lên Firebase...';
    try {
      const res = await fetchFirebaseWithFallback(AdminConfig.firebaseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const totalRooms = (getMap().getActiveSheet().rooms || []).length;
        const totalSV = (payload.streetViewNodes || []).filter(n => n.img).length;
        if (statusEl) statusEl.textContent = '☁️ Đã đồng bộ Cloud';
        notify(`✅ Đã đẩy toàn bộ lên Cloud (${totalRooms} ô, ${totalSV} ảnh Street View)!`);
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        if (statusEl) statusEl.textContent = '❌ Bị chặn quyền (401)';
        notify('❌ Firebase từ chối ghi (401)! Hãy vào tab Rules trên Firebase đặt .read và .write = true rồi Publish.');
      } else {
        if (statusEl) statusEl.textContent = '❌ Lỗi Cloud: ' + (e.message || '');
        notify('❌ Chưa đẩy lên Cloud được (' + (e.message || 'Kiểm tra lại link Firebase') + '). Đã giữ bản lưu trên máy!');
      }
    }
  }

  async function pullFromFirebaseCloud(isManual) {
    const rawUrl = (document.getElementById('adm-firebase-url')?.value || AdminConfig.firebaseUrl || '').trim();
    AdminConfig.firebaseUrl = normalizeFirebaseUrl(rawUrl || DEFAULT_FIREBASE_URL);
    const urlIn = document.getElementById('adm-firebase-url');
    if (urlIn) urlIn.value = AdminConfig.firebaseUrl;
    const statusEl = document.getElementById('adm-cloud-status');

    try {
      const res = await fetchFirebaseWithFallback(AdminConfig.firebaseUrl, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        const data = sanitizeCloudState(raw);
        if (data) {
          const curRole = getState().adminRole;
          Object.assign(getState(), data);
          getState().adminRole = curRole;
          getMap().saveStorage();
          getMap().render();
          if (curRole !== 'NONE') updateAdminWorkspaceUI();
          if (window.NQDStreetView) {
            window.NQDStreetView.renderMapPins();
            window.NQDStreetView.refreshAdminStreetViewTab();
          }
          if (statusEl) statusEl.textContent = '☁️ Đã đồng bộ Cloud';
          if (isManual) notify('🔄 Đã tải toàn bộ dữ liệu mới nhất từ Cloud!');
          return;
        }
      }
      if (isManual) notify('Chưa có dữ liệu trên nhánh Cloud này — Hãy bấm ☁️ Đẩy Cloud trước.');
    } catch (e) {
      if (isManual) notify('❌ Không tải được từ Cloud (' + (e.message || 'Kiểm tra Rules Firebase') + ').');
    }
  }

  function initAdminStudio() {
    loadAdminSettings();
    pullFromFirebaseCloud();

    document.getElementById('btn-admin-login-toggle').addEventListener('click', () => {
      const st = getState();
      if (st.adminRole !== 'NONE') {
        st.adminRole = 'NONE';
        st.vertexEditMode = false;
        updateAdminWorkspaceUI();
        notify('Đã thoát chế độ Quản trị.');
        return;
      }
      document.getElementById('adm-login-error').classList.add('hidden');
      document.getElementById('adm-login-pass-input').value = '';
      const m = document.getElementById('admin-auth-modal');
      m.classList.remove('hidden');
      m.classList.add('flex');
    });

    document.getElementById('btn-close-auth-modal').addEventListener('click', () => {
      const m = document.getElementById('admin-auth-modal');
      m.classList.add('hidden');
      m.classList.remove('flex');
    });

    document.getElementById('btn-submit-auth').addEventListener('click', () => {
      const val = document.getElementById('adm-login-pass-input').value.trim();
      const st = getState();
      if (val === AdminConfig.passwords.FA) {
        st.adminRole = 'FA';
      } else if (val === AdminConfig.passwords.AL) {
        st.adminRole = 'AL';
        let evSheet = st.sheets.find(s => !s.lockedOrigin);
        if (!evSheet) {
          evSheet = {
            id: 'sheet_ev_1',
            name: '🎪 Sự Kiện 1',
            lockedOrigin: false,
            rooms: JSON.parse(JSON.stringify(st.sheets[0].rooms)),
            fixedLines: []
          };
          st.sheets.push(evSheet);
        }
        st.activeSheetId = evSheet.id;
      } else {
        document.getElementById('adm-login-error').classList.remove('hidden');
        return;
      }

      const m = document.getElementById('admin-auth-modal');
      m.classList.add('hidden');
      m.classList.remove('flex');
      refreshHeaderAndTagsTab();
      updateAdminWorkspaceUI();
      notify(st.adminRole === 'FA' ? '👑 Đã mở Full Admin (Tỷ lệ 6/4).' : '🎨 Đã mở Admin Lite.');
    });

    document.getElementById('btn-studio-exit').addEventListener('click', () => {
      getState().adminRole = 'NONE';
      getState().vertexEditMode = false;
      updateAdminWorkspaceUI();
    });
    document.getElementById('btn-studio-push-cloud').addEventListener('click', pushToFirebaseCloud);

    document.getElementById('btn-create-event-sheet').addEventListener('click', () => {
      const st = getState();
      if (st.adminRole !== 'FA') return;
      const origin = st.sheets[0];
      const newSheet = {
        id: 'sheet_ev_' + Date.now(),
        name: `🎪 Sự Kiện ${st.sheets.length}`,
        lockedOrigin: false,
        rooms: JSON.parse(JSON.stringify(origin.rooms)),
        fixedLines: []
      };
      st.sheets.push(newSheet);
      st.activeSheetId = newSheet.id;
      getMap().render();
      renderSheetBar();
      refreshInspectorPanel();
      notify(`Đã tạo "${newSheet.name}".`);
    });

    document.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.studio-tab-btn').forEach(b => {
          const active = b.dataset.tab === target;
          b.className = `studio-tab-btn ${b.classList.contains('fa-only-tab') ? 'fa-only-tab' : ''} flex-1 py-2 text-[11px] font-bold border-b-2 transition ${
            active ? 'border-sky-400 text-sky-400 bg-slate-900/90' : 'border-transparent text-slate-400 hover:text-white'
          }`;
        });
        document.querySelectorAll('.studio-tab-pane').forEach(p => p.classList.add('hidden'));
        document.getElementById('studio-pane-' + target).classList.remove('hidden');
        if (target === 'header' || target === 'sponsors') refreshHeaderAndTagsTab();
        if (window.NQDStreetView) { window.NQDStreetView.setAdminTabActive(target === 'streetview'); if (target === 'streetview') window.NQDStreetView.refreshAdminStreetViewTab(); }
      });
    });

    document.getElementById('chk-unlock-origin').addEventListener('change', (e) => {
      AdminConfig.unlockOriginMap = e.target.checked;
      refreshInspectorPanel();
    });
    document.getElementById('chk-admin-grid').addEventListener('change', (e) => {
      getState().snapToGrid = e.target.checked;
      document.getElementById('map-world').classList.toggle('admin-grid-overlay', e.target.checked);
    });
    document.getElementById('btn-toggle-drag-mode').addEventListener('click', (e) => {
      AdminConfig.dragEnabled = !AdminConfig.dragEnabled;
      e.currentTarget.className = `px-2.5 py-1 rounded-lg text-xs font-bold transition ${
        AdminConfig.dragEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
      }`;
    });

    document.getElementById('btn-adm-add-booth').addEventListener('click', () => {
      const st = getState();
      if (st.adminRole === 'AL' && !AdminConfig.alPermissions.createBooth) return;
      const sheet = getMap().getActiveSheet();
      if (sheet.lockedOrigin && !AdminConfig.unlockOriginMap) {
        notify('Hãy mở khóa Map Gốc hoặc chuyển sang Sheet Sự kiện.');
        return;
      }
      const id = 'booth_' + Date.now();
      pushUndoSnapshot();
      sheet.rooms.push({
        id,
        name: 'Gian hàng CLB',
        floor: 'TRET',
        category: 'NGOAIVI',
        x: 680,
        y: 820,
        w: 84,
        h: 56,
        color: '#f59e0b',
        textColor: '#0f172a',
        fontSize: 13,
        angle: 0,
        shape: 'rect',
        isClubBooth: true,
        tags: ['tag_checkin'],
        tooltipEmoji: '🎪',
        tooltipText: 'Gian hàng Câu lạc bộ',
        tooltipBg: '#fef3c7',
        desc: 'Gian hàng hoạt động sự kiện.'
      });
      st.selectedRoomId = id;
      st.multiSelectedIds = [id];
      getMap().render();
      refreshInspectorPanel();
    });

    document.getElementById('btn-adm-add-tree').addEventListener('click', () => {
      const st = getState();
      const sheet = getMap().getActiveSheet();
      if (sheet.lockedOrigin && !AdminConfig.unlockOriginMap) return;
      const id = 'tree_' + Date.now();
      pushUndoSnapshot();
      sheet.rooms.push({
        id,
        name: '🌳 Ô Cây xanh',
        floor: 'TRET',
        category: 'NGOAIVI',
        isTree: true,
        x: 680,
        y: 1020,
        w: 76,
        h: 76,
        color: '#bbf7d0',
        textColor: '#14532d',
        fontSize: 11,
        angle: 0,
        shape: 'circle',
        tags: [],
        tooltipEmoji: '🌳',
        tooltipText: 'Mảng cây xanh khuôn viên trường',
        tooltipBg: '#dcfce7',
        desc: 'Khu vực cây xanh.'
      });
      st.selectedRoomId = id;
      st.multiSelectedIds = [id];
      getMap().render();
      refreshInspectorPanel();
    });

    
    document.getElementById('btn-adm-add-step')?.addEventListener('click', () => {
      const st = getState();
      const sheet = getMap().getActiveSheet();
      if (sheet.lockedOrigin && !AdminConfig.unlockOriginMap) {
        notify('Hãy mở khóa Map Gốc hoặc chuyển sang Sheet Sự kiện.');
        return;
      }
      const id = 'step_' + Date.now();
      pushUndoSnapshot();
      sheet.rooms.push({
        id,
        name: 'Bậc thang',
        floor: 'TRET',
        category: 'NGOAIVI',
        isStep: true,
        x: 720,
        y: 1234,
        w: 32,
        h: 14,
        color: '#fbbf24',
        textColor: '#0f172a',
        fontSize: 8,
        angle: 0,
        shape: 'rect',
        tags: [],
        tooltipEmoji: '🪜',
        tooltipText: 'Bậc thang lên xuống hành lang',
        tooltipBg: '#fef3c7',
        desc: 'Ô bậc thang đánh dấu lối lên xuống hành lang.'
      });
      st.selectedRoomId = id;
      st.multiSelectedIds = [id];
      getMap().render();
      refreshInspectorPanel();
      notify('🪜 Đã thêm ô Bậc thang mới — Kéo đặt vào đúng vị trí lối lên xuống!');
    });

    document.getElementById('btn-adm-delete-room').addEventListener('click', () => {
      const targets = getSelectedEditableRooms('moveResize');
      if (targets.length === 0) return;
      const sheet = getMap().getActiveSheet();
      const delSet = new Set(targets.map(r => r.id));
      pushUndoSnapshot();
      sheet.rooms = sheet.rooms.filter(r => !delSet.has(r.id));
      getState().selectedRoomId = null;
      getState().multiSelectedIds = [];
      getMap().render();
    });

    document.getElementById('adm-name').addEventListener('input', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.name = e.target.value; });
      getMap().renderRooms();
    });
    document.getElementById('adm-floor').addEventListener('change', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.floor = e.target.value; });
      getMap().renderRooms();
    });
    document.getElementById('adm-category').addEventListener('change', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.category = e.target.value; });
      getMap().renderRooms();
    });
    document.getElementById('adm-repair').addEventListener('change', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.repairMode = e.target.checked; });
      getMap().renderRooms();
    });

    ['x', 'y', 'w', 'h'].forEach(k => {
      document.getElementById('adm-' + k).addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (isNaN(val)) return;
        getSelectedEditableRooms('moveResize').forEach(r => { r[k] = val; });
        getMap().renderRooms();
      });
    });

    document.getElementById('adm-color').addEventListener('input', (e) => {
      getSelectedEditableRooms('shape').forEach(r => { r.color = e.target.value; });
      getMap().renderRooms();
    });

    document.querySelectorAll('.adm-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sh = btn.dataset.shape;
        getSelectedEditableRooms('shape').forEach(r => {
          r.shape = sh;
          if (sh === 'trapezoid' && !r.polygon) r.polygon = '0 6, 100 0, 100 100, 0 94';
          if (sh === 'custom' && !r.polygon) r.polygon = '0 0, 100 0, 88 100, 12 100';
        });
        getMap().renderRooms();
        refreshInspectorPanel();
      });
    });

    document.getElementById('btn-adm-vertex-mode').addEventListener('click', () => {
      const st = getState();
      st.vertexEditMode = !st.vertexEditMode;
      getSelectedEditableRooms('shape').forEach(r => {
        if (!r.polygon) r.polygon = '0 0, 100 0, 88 100, 12 100';
        r.shape = 'custom';
      });
      getMap().renderRooms();
      refreshInspectorPanel();
    });

    document.getElementById('btn-adm-add-vertex').addEventListener('click', () => {
      getSelectedEditableRooms('shape').forEach(r => {
        const pts = getMap().parsePolygonPoints(r.polygon);
        pts.push({ x: 50, y: 100 });
        r.shape = 'custom';
        r.polygon = pts.map(p => `${p.x} ${p.y}`).join(', ');
      });
      getMap().renderRooms();
      refreshInspectorPanel();
    });

    document.getElementById('btn-adm-remove-vertex').addEventListener('click', () => {
      getSelectedEditableRooms('shape').forEach(r => {
        const pts = getMap().parsePolygonPoints(r.polygon);
        if (pts.length > 3) pts.pop();
        r.shape = 'custom';
        r.polygon = pts.map(p => `${p.x} ${p.y}`).join(', ');
      });
      getMap().renderRooms();
      refreshInspectorPanel();
    });

    document.getElementById('adm-polygon-points').addEventListener('input', (e) => {
      getSelectedEditableRooms('shape').forEach(r => {
        r.shape = 'custom';
        r.polygon = e.target.value;
      });
      getMap().renderRooms();
    });

    document.getElementById('adm-text-color').addEventListener('input', (e) => {
      getSelectedEditableRooms('typography').forEach(r => { r.textColor = e.target.value; });
      getMap().renderRooms();
    });
    document.getElementById('adm-fontsize').addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      document.getElementById('lbl-adm-fontsize').textContent = v + 'px';
      getSelectedEditableRooms('typography').forEach(r => { r.fontSize = v; });
      getMap().renderRooms();
    });
    document.getElementById('adm-angle').addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      document.getElementById('lbl-adm-angle').textContent = v + '°';
      getSelectedEditableRooms('typography').forEach(r => {
        r.verticalText = false;
        r.angle = v;
      });
      getMap().renderRooms();
    });
    document.querySelectorAll('.adm-angle-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.angle;
        getSelectedEditableRooms('typography').forEach(r => {
          if (mode === 'stack') {
            r.verticalText = true;
            r.angle = 0;
          } else {
            r.verticalText = false;
            r.angle = parseInt(mode, 10);
          }
        });
        getMap().renderRooms();
        refreshInspectorPanel();
      });
    });
    document.getElementById('adm-font-url').addEventListener('change', (e) => {
      getSelectedEditableRooms('typography').forEach(r => { r.fontUrl = e.target.value.trim(); });
      getMap().renderRooms();
    });
    document.getElementById('adm-font-family').addEventListener('input', (e) => {
      getSelectedEditableRooms('typography').forEach(r => { r.fontFamily = e.target.value.trim(); });
      getMap().renderRooms();
    });

    document.getElementById('adm-tip-emoji').addEventListener('input', (e) => {
      getSelectedEditableRooms('tooltip').forEach(r => { r.tooltipEmoji = e.target.value; });
    });
    document.getElementById('adm-tip-bg').addEventListener('input', (e) => {
      getSelectedEditableRooms('tooltip').forEach(r => { r.tooltipBg = e.target.value; });
    });
    document.getElementById('adm-tip-text').addEventListener('input', (e) => {
      getSelectedEditableRooms('tooltip').forEach(r => { r.tooltipText = e.target.value; });
    });

    document.getElementById('adm-img-url').addEventListener('input', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.img = e.target.value; });
    });
    document.getElementById('adm-img-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        getSelectedEditableRooms('content').forEach(r => { r.img = reader.result; });
        document.getElementById('adm-img-url').value = '[Ảnh tải lên]';
        getMap().saveStorage();
      };
      reader.readAsDataURL(f);
    });
    document.getElementById('adm-desc').addEventListener('input', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.desc = e.target.value; });
    });

    document.getElementById('adm-interior-public').addEventListener('change', (e) => {
      getSelectedEditableRooms('content').forEach(r => { r.interiorPublic = e.target.checked; });
      getMap().renderRooms();
    });
    document.getElementById('btn-open-interior-designer').addEventListener('click', openInteriorDesignerModal);
    document.getElementById('btn-close-int-designer').addEventListener('click', () => {
      const m = document.getElementById('admin-interior-designer-modal');
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
    document.getElementById('btn-adm-add-subbooth').addEventListener('click', () => {
      const st = getState();
      const sheet = getMap().getActiveSheet();
      const room = sheet.rooms.find(r => r.id === st.selectedRoomId);
      if (!room) return;
      const nameIn = document.getElementById('adm-new-subbooth-title');
      const title = nameIn.value.trim() || `Quầy #${(room.subBooths || []).length + 1}`;
      room.subBooths = room.subBooths || [];
      const idx = room.subBooths.length;
      room.subBooths.push({
        id: 'sb_' + Date.now(),
        name: title,
        rx: 10 + (idx % 2) * 44,
        ry: 12 + Math.floor(idx / 2) * 28,
        rw: 38,
        rh: 22,
        color: '#f59e0b'
      });
      nameIn.value = '';
      renderInteriorDesignerCanvas(room);
      getMap().renderRooms();
      refreshInspectorPanel();
    });

    document.getElementById('adm-ev-active').addEventListener('change', (e) => {
      getState().headerConfig.eventActive = e.target.checked;
      getMap().render();
    });
    document.getElementById('adm-ev-title').addEventListener('input', (e) => {
      getState().headerConfig.eventTitle = e.target.value;
      getMap().render();
    });
    document.getElementById('adm-ev-date').addEventListener('input', (e) => {
      getState().headerConfig.eventDate = e.target.value;
      getMap().render();
    });
    document.getElementById('adm-ev-font-preset').addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      const [fam, url] = val.split('|');
      document.getElementById('adm-ev-font-name').value = fam;
      document.getElementById('adm-ev-font-link').value = url || '';
      getState().headerConfig.fontName = fam;
      getState().headerConfig.fontLink = url || '';
      getMap().render();
    });
    document.getElementById('adm-ev-font-link').addEventListener('change', (e) => {
      getState().headerConfig.fontLink = e.target.value.trim();
      getMap().render();
    });
    document.getElementById('adm-ev-font-name').addEventListener('input', (e) => {
      getState().headerConfig.fontName = e.target.value.trim();
      getMap().render();
    });
    document.getElementById('btn-adm-add-logo').addEventListener('click', () => {
      const hc = getState().headerConfig;
      hc.logos = hc.logos || [];
      hc.logos.push({ id: 'lg_' + Date.now(), short: 'CLB', name: 'Đơn vị đồng tổ chức', img: '' });
      refreshHeaderAndTagsTab();
      getMap().render();
    });
    document.getElementById('btn-adm-add-tag').addEventListener('click', () => {
      const st = getState();
      st.eventTags.push({ id: 'tag_' + Date.now(), icon: '⭐', label: 'Nhãn sự kiện mới' });
      refreshHeaderAndTagsTab();
      refreshInspectorPanel();
      getMap().render();
    });

    document.getElementById('btn-adm-add-sponsor').addEventListener('click', () => {
      const tier = document.getElementById('adm-sp-tier').value;
      const name = document.getElementById('adm-sp-name').value.trim();
      const logo = document.getElementById('adm-sp-logo').value.trim() || '💎';
      const link = document.getElementById('adm-sp-link').value.trim() || 'https://ntp0812.github.io/nqdmap/';
      if (!name) return;
      getState().sponsors.push({ id: 'sp_' + Date.now(), tier, name, logo, link });
      document.getElementById('adm-sp-name').value = '';
      refreshHeaderAndTagsTab();
      getMap().render();
      getMap().saveStorage();
    });

    document.getElementById('btn-adm-add-fixed-line').addEventListener('click', () => {
      const from = document.getElementById('adm-fl-from').value;
      const to = document.getElementById('adm-fl-to').value;
      const label = document.getElementById('adm-fl-label').value.trim() || 'Lộ trình sự kiện';
      const color = document.getElementById('adm-fl-color').value || '#10b981';
      if (!from || !to || from === to) return;
      const sheet = getMap().getActiveSheet();
      sheet.fixedLines = sheet.fixedLines || [];
      sheet.fixedLines.push({ id: 'fl_' + Date.now(), from, to, label, color });
      refreshHeaderAndTagsTab();
      getMap().render();
    });

    document.querySelectorAll('.adm-fx-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = getState();
        st.seasonalEffect.type = btn.dataset.fx;
        document.getElementById('select-season-preview').value = btn.dataset.fx;
        getMap().runSeasonalEffects();
        getMap().saveStorage();
      });
    });
    document.getElementById('adm-fx-token').addEventListener('input', (e) => {
      const st = getState();
      st.seasonalEffect.customToken = e.target.value || '✨';
      st.seasonalEffect.type = 'custom';
      getMap().runSeasonalEffects();
    });
    document.getElementById('adm-fx-count').addEventListener('input', (e) => {
      getState().seasonalEffect.count = parseInt(e.target.value, 10);
      getMap().runSeasonalEffects();
    });
    document.getElementById('adm-fx-speed').addEventListener('input', (e) => {
      getState().seasonalEffect.speed = parseFloat(e.target.value);
      getMap().runSeasonalEffects();
    });
    document.getElementById('btn-adm-run-injected').addEventListener('click', () => {
      getState().seasonalEffect.injectedCode = document.getElementById('adm-injected-code').value;
      getMap().runInjectedExternalCode();
      getMap().saveStorage();
      notify('✨ Đã áp dụng mã hiệu ứng nhúng.');
    });
    document.getElementById('btn-adm-clear-injected').addEventListener('click', () => {
      document.getElementById('adm-injected-code').value = '';
      getState().seasonalEffect.injectedCode = '';
      getMap().runInjectedExternalCode();
      getMap().saveStorage();
    });

    document.getElementById('adm-firebase-url').value = AdminConfig.firebaseUrl;
    document.getElementById('adm-pass-fa').value = AdminConfig.passwords.FA;
    document.getElementById('adm-pass-al').value = AdminConfig.passwords.AL;

    document.querySelectorAll('.adm-al-perm-chk').forEach(chk => {
      const key = chk.dataset.perm;
      chk.checked = !!AdminConfig.alPermissions[key];
      chk.addEventListener('change', () => {
        AdminConfig.alPermissions[key] = chk.checked;
        syncAdminSettingsToState();
      });
    });

    document.getElementById('btn-adm-save-passwords').addEventListener('click', () => {
      const fa = document.getElementById('adm-pass-fa').value.trim();
      const al = document.getElementById('adm-pass-al').value.trim();
      if (fa) AdminConfig.passwords.FA = fa;
      if (al) AdminConfig.passwords.AL = al;
      syncAdminSettingsToState();
      notify('🔐 Đã lưu mật khẩu FA & AL.');
    });

    document.getElementById('btn-adm-cloud-push').addEventListener('click', pushToFirebaseCloud);
    document.getElementById('btn-adm-cloud-pull').addEventListener('click', () => pullFromFirebaseCloud(true));

    document.getElementById('btn-adm-export-json').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nqd_smart_map_backup.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('adm-import-json-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (data && Array.isArray(data.sheets)) {
            const role = getState().adminRole;
            Object.assign(getState(), data);
            getState().adminRole = role;
            getMap().render();
            updateAdminWorkspaceUI();
            notify('📦 Đã khôi phục dữ liệu từ file JSON.');
          }
        } catch (err) {
          notify('File JSON không hợp lệ.');
        }
      };
      r.readAsText(f);
    });

    document.getElementById('btn-adm-reset-default').addEventListener('click', () => {
      localStorage.removeItem('NQD_MAP_DATA_V9');
      window.location.reload();
    });
  }

  window.NQDAdmin = {
    config: AdminConfig,
    onRoomPointerDown,
    refreshInspectorPanel,
    renderVertexHandlesOnMap,
    updateAdminWorkspaceUI,
    pushToFirebaseCloud,
    pullFromFirebaseCloud,
    init: initAdminStudio
  };
})(window);
