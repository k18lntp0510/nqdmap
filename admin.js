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
  </script>
  <!-- MODULE 3: ROUTING.JS -->
  <script>
/**
 * ============================================================================
 * PHẦN 3: MODULE CHỈ ĐƯỜNG NGẮN NHẤT & ĐỊNH VỊ QR 20M (routing.js — V2)
 * Dự án KHKT: Bản đồ số tương tác & Điều hướng sự kiện THPT Chuyên Nguyễn Quang Diêu
 * - Lưới A* độ phân giải cao (10px) + vùng đệm an toàn: Tuyệt đối KHÔNG đè công trình
 * - Né tuyệt đối mọi khu vực & cầu thang gắn nhãn "🔧 Đang sửa" (tự chọn cầu thang khác)
 * - Khóa cứng vùng cấm cắt ngang Khu vực Sân Chào Cờ (trừ khi đi/đến Cột cờ)
 * - Chế độ Dẫn Đường Từng Chặng (Kiểu 2 giống Google Maps) khi đi khác tầng:
 *   + Chặng 1: Chỉ vẽ từ Điểm A ➔ Cầu thang (màu Xanh dương)
 *   + Bấm nút [🪜 Đã lên Lầu X ➔ Xem tiếp Chặng 2]: Tự động lọc sáng tầng đích & vẽ Chặng 2 (màu Đỏ)
 * - Hệ thống 12 Trạm Mã QR Định vị 20m (?from=qr_tram_...) + "Tôi đang ở đâu?"
 * ============================================================================
 */
(function (window) {
  'use strict';

  const QR_STATIONS = [
    { qrId: 'qr_tram_01', roomId: 'cong_chinh', label: 'Trạm QR 01 — Cổng Chính Trường', zone: 'Trục Trung Tâm' },
    { qrId: 'qr_tram_02', roomId: 'tuong_cu', label: 'Trạm QR 02 — Tượng Cụ / Sảnh Thông Báo', zone: 'Khu Hành Chính' },
    { qrId: 'qr_tram_03', roomId: 'cot_co', label: 'Trạm QR 03 — Cột Cờ Giữa Sân', zone: 'Sân Trường' },
    { qrId: 'qr_tram_04', roomId: 'stair_west', label: 'Trạm QR 04 — Ngã 3 Thư Viện & Cầu Thang Trái', zone: 'Dãy Học Trái' },
    { qrId: 'qr_tram_05', roomId: 'sanh_av', label: 'Trạm QR 05 — Sảnh Anh Văn (Hành Lang Trái)', zone: 'Dãy Học Trái' },
    { qrId: 'qr_tram_06', roomId: 'wc_1_1', label: 'Trạm QR 06 — Đầu Hành Lang Trái (Cạnh WC 1.1)', zone: 'Dãy Giữa' },
    { qrId: 'qr_tram_07', roomId: 'sanh_chao_co', label: 'Trạm QR 07 — Sảnh Chào Cờ & Cầu Thang Giữa', zone: 'Dãy Giữa' },
    { qrId: 'qr_tram_08', roomId: 'phong_y_te', label: 'Trạm QR 08 — Ngã 4 Phòng Y Tế & WC 1.2', zone: 'Dãy Giữa' },
    { qrId: 'qr_tram_09', roomId: 'can_tin', label: 'Trạm QR 09 — Lối Xuống Căn Tin & KTX Lớn', zone: 'Ngoại Vi Phải' },
    { qrId: 'qr_tram_10', roomId: 'stair_east', label: 'Trạm QR 10 — Cầu Thang Dãy Phải & Hội Trường Lớn', zone: 'Dãy Thực Hành Phải' },
    { qrId: 'qr_tram_11', roomId: 'r_10t1', label: 'Trạm QR 11 — Hành Lang Khu KTX Bắc (10T1)', zone: 'Khu Bắc' },
    { qrId: 'qr_tram_12', roomId: 'vuon_rau', label: 'Trạm QR 12 — Khu Vườn Rau & Sân Bóng Đá', zone: 'Ngoại Vi Bắc' }
  ];

  const GRID_STEP = 10;
  let targetSubBoothId = null;

  // Trạng thái dẫn đường từng chặng (Kiểu 2)
  let currentLegStep = 1; // 1 = Chặng 1 (Điểm A -> Cầu thang), 2 = Chặng 2 (Cầu thang -> Điểm B)
  let lastRoutePairKey = '';

  function getMap() { return window.NQDMap; }
  function getState() { return window.NQDMap ? window.NQDMap.state : null; }

  function notify(msg) {
    const t = document.getElementById('admin-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(window.__rtToastTimer);
    window.__rtToastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
  }

  function normalizeFloor(fl) {
    if (!fl || fl === 'HANHCHINH' || fl === 'NGOAIVI' || fl === 'ALL') return 'TRET';
    return fl;
  }

  function floorDisplayName(fl) {
    if (fl === 'LAU1') return 'Lầu 1';
    if (fl === 'LAU2') return 'Lầu 2';
    return 'Tầng Trệt';
  }

  // 1. TỌA ĐỘ CỬA RA VÀO HÀNH LANG CHÍNH XÁC (KHÔNG CẮT NGANG CÔNG TRÌNH)
  function getRoomDoorOnCorridor(room, subId) {
    if (subId && room.interiorPublic && Array.isArray(room.subBooths)) {
      const sb = room.subBooths.find(s => s.id === subId);
      if (sb) {
        return {
          x: room.x + ((sb.rx + sb.rw / 2) / 100) * room.w,
          y: room.y + ((sb.ry + sb.rh / 2) / 100) * room.h
        };
      }
    }

    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;

    // Cổng chính & Tượng Cụ
    if (room.id === 'cong_chinh') return { x: 860, y: 1532 };
    if (room.id === 'tuong_cu') return { x: 860, y: 1435 };
    if (room.id === 'cot_co') return { x: 860, y: 946 };

    // Cầu thang: Neo thẳng vào tim hành lang liền kề cầu thang
    if (room.id === 'stair_west') return { x: 539, y: 1204 };
    if (room.id === 'stair_east') return { x: 1181, y: 1258 };
    if (room.id === 'stair_mid_left') return { x: 685, y: 699 };
    if (room.id === 'stair_mid_right') return { x: 978, y: 699 };
    if (room.id === 'stair_north') return { x: 1181, y: 270 };

    // Dãy Học Trái (Trệt / Lầu 1 / Lầu 2) -> Mở vào Hành lang Tây (x = 539)
    if (room.x + room.w <= 524 && room.y >= 485 && room.y <= 1185) {
      return { x: 539, y: cy };
    }

    // Dãy Thực Hành & Bộ Môn Phải (1B: Trệt | Lầu 1 | Lầu 2) -> Mở vào Hành lang Đông (x = 1181)
    if (room.x >= 1196 && room.x <= 1400 && room.y >= 485 && room.y <= 1245) {
      return { x: 1181, y: cy };
    }

    // Thư Viện mở sang Hành lang Tây (x = 539); Sảnh Thư Viện mở ra Bậc thang mặt tiền (x = 424, y = 1425)
    if (room.id === 'sanh_thu_vien') return { x: 539, y: 1261 };
    if (room.id === 'thu_vien') return { x: 539, y: 1261 };
    if (room.y >= 1275 && room.y <= 1415 && room.x >= 500 && room.x <= 1210) {
      return { x: cx, y: 1261 };
    }

    // Dãy Chính Giữa (Trệt / Lầu 1 / Lầu 2) -> Mở xuống Hành lang Chính Giữa (y = 699)
    if (room.y >= 485 && room.y <= 685 && room.x >= 550 && room.x <= 1170) {
      return { x: cx, y: 699 };
    }

    // Khu KTX & Lớp Học Phía Bắc -> Mở xuống Hành lang Bắc (x = 860, y = 376) hoặc Hành lang Đông (x = 1181)
    if (room.y <= 368 && room.x >= 800 && room.x <= 1210) {
      if (room.x >= 1080) return { x: 1181, y: cy };
      return { x: 860, y: 376 };
    }

    // Khu Ngoại Vi: Neo vào mép đường đi bên ngoài gần nhất (không đâm vào tâm khối)
    if (room.id === 'hoi_truong_lon') return { x: 1425, y: 1020 };
    if (room.id === 'can_tin') return { x: 1415, y: 600 };
    if (room.id === 'ktx_lon_moi') return { x: 1588, y: 580 };
    if (room.id === 'nha_thi_dau') return { x: 1270, y: 240 };
    if (room.id === 'nha_xe_hs') return { x: 232, y: 735 };
    if (room.id === 'nha_xe_gv') return { x: 1320, y: 1455 };
    if (room.id === 'san_bong_da') return { x: 565, y: 170 };
    if (room.id === 'vuon_rau') return { x: 775, y: 320 };

    // Mặc định (gian hàng CLB mới tạo): mép gần sân nhất
    return { x: cx, y: Math.max(20, room.y - 12) };
  }

  // Điểm chạm mép phòng khi kết thúc (để Line chỉ chạm gọn vào cửa, không đè xuyên qua các phòng tầng khác)
  function getRoomEdgeTouchPoint(room, doorPt) {
    // Chỉ nối 1 đoạn thẳng vuông góc ngắn (<= 26px) vào đúng mép cửa phòng; tuyệt đối không nối chéo đè phòng bên cạnh!
    const clampedX = Math.max(room.x + 2, Math.min(room.x + room.w - 2, doorPt.x));
    const clampedY = Math.max(room.y + 2, Math.min(room.y + room.h - 2, doorPt.y));
    const dx = Math.abs(doorPt.x - clampedX);
    const dy = Math.abs(doorPt.y - clampedY);
    if ((dx === 0 && dy <= 28) || (dy === 0 && dx <= 28)) {
      return { x: clampedX, y: clampedY };
    }
    return { x: doorPt.x, y: doorPt.y };
  }

  // 2. XÂY DỰNG LƯỚI VẬT CẢN CHẶT CHẼ (PAD = 8PX + NÉ ĐANG SỬA + NÉ SÂN CHÀO CỜ)
  function buildWalkableGrid(sheet, startId, endId, activeFloor) {
    const st = getState();
    const mapW = st.worldWidth || 1850;
    const mapH = st.worldHeight || 1700;
    const cols = Math.ceil(mapW / GRID_STEP);
    const rows = Math.ceil(mapH / GRID_STEP);
    const blocked = new Uint8Array(cols * rows);

    function markRect(x, y, w, h, pad) {
      const c0 = Math.max(0, Math.floor((x - pad) / GRID_STEP));
      const c1 = Math.min(cols - 1, Math.floor((x + w + pad) / GRID_STEP));
      const r0 = Math.max(0, Math.floor((y - pad) / GRID_STEP));
      const r1 = Math.min(rows - 1, Math.floor((y + h + pad) / GRID_STEP));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          blocked[r * cols + c] = 1;
        }
      }
    }

    // 1. VÙNG CẤM TUYỆT ĐỐI: Khu vực Sân Chào Cờ (trừ khi xuất phát hoặc đích là Cột cờ)
    if (startId !== 'cot_co' && endId !== 'cot_co') {
      markRect(780, 752, 160, 235, 8);
    }

    // 2. Chặn toàn bộ công trình, phòng học, cây xanh với khoảng đệm an toàn (pad = 8px)
    //    Riêng các khu vực đang bật "🔧 Đang sửa" (repairMode) bị chặn mở rộng thêm (pad = 16px)
    sheet.rooms.forEach(r => {
      if (r.repairMode) {
        // Khu vực Đang sửa: chặn cứng + mở rộng vùng cấm để Line vòng tránh hoàn toàn!
        markRect(r.x, r.y, r.w, r.h, 16);
        return;
      }
      if (r.isStair || r.isStep) return;
      if (r.id === endId && r.interiorPublic && targetSubBoothId) return;

      // Chặn toàn bộ khối phòng & cây xanh với vùng đệm 8px (Line tuyệt đối không liếm tường!)
      markRect(r.x, r.y, r.w, r.h, 8);
    });

    // 3. LAN CAN HÀNH LANG (CHỐNG NHẢY QUA LAN CAN & CHỐNG CHUI KHE HỞ GIỮA WC - DÃY PHÒNG):
    // Khóa viền mép ngoài của toàn bộ hệ thống hành lang trên cao; chỉ cho phép đi lên/xuống tại ô "Bậc thang" hoặc "Cầu thang"!
    markRect(556, 720, 8, 522, 0);    // Lan can dọc mép trong Hành lang Tây (giáp Sân trường)
    markRect(1154, 720, 8, 522, 0);   // Lan can dọc mép trong Hành lang Đông (giáp Sân trường)
    markRect(556, 1234, 606, 8, 0);   // Lan can dọc mép trên Hành lang Nam (giáp Sân trường)
    markRect(556, 718, 606, 8, 0);    // Lan can dọc mép dưới Hành lang Giữa (giáp Sân trường)
    markRect(514, 690, 8, 55, 0);     // Chặn khe hở giữa cụm WC 1.1-3.1 và Dãy Học Trái (chống nhảy lan can ra Nhà xe!)
    markRect(1198, 700, 8, 95, 0);    // Lan can mép ngoài Hành lang Đông tại Lối xuống căn tin (chỉ mở tại Bậc thang!)
    markRect(1198, 360, 8, 132, 0);   // Lan can mép ngoài Hành lang Đông khu Bắc (chỉ mở tại Bậc thang!)
    markRect(810, 360, 8, 132, 0);    // Lan can mép trái Hành lang Bắc (chỉ mở tại Bậc thang ra Vườn rau!)
    markRect(514, 1240, 8, 50, 0);    // Lan can góc Tây-Nam gần Sảnh Thư viện (chỉ mở tại Bậc thang!)

    function carveArea(x, y, w, h) {
      const c0 = Math.max(0, Math.floor(x / GRID_STEP));
      const c1 = Math.min(cols - 1, Math.floor((x + w) / GRID_STEP));
      const r0 = Math.max(0, Math.floor(y / GRID_STEP));
      const r1 = Math.min(rows - 1, Math.floor((y + h) / GRID_STEP));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          blocked[r * cols + c] = 0;
        }
      }
    }

    // 4. Thông thoáng tim hệ thống Hành lang chính
    carveArea(530, 492, 18, 778);   // Tim Hành lang Tây
    carveArea(1172, 360, 18, 910);  // Tim Hành lang Đông
    carveArea(530, 1252, 660, 18);  // Tim Hành lang Nam
    carveArea(530, 690, 660, 18);   // Tim Hành lang Chính Giữa
    carveArea(850, 368, 20, 126);   // Tim Hành lang Bắc

    // 5. MỞ CỔNG ĐI LÊN/XUỐNG CHÍNH XÁC TẠI CÁC Ô "BẬC THANG" (isStep) KHÔNG BỊ SỬA!
    const stepZones = [];
    sheet.rooms.forEach(r => {
      if (r.isStep && !r.repairMode) {
        // Mở lối theo đúng trục ngắn của Bậc thang (ngang hoặc dọc) để không ăn lấn sang phòng kế bên
        const isHorizontalStep = r.w >= r.h;
        if (isHorizontalStep) {
          carveArea(r.x, r.y - 18, r.w, r.h + 36);
        } else {
          carveArea(r.x - 18, r.y, r.w + 36, r.h);
        }
        stepZones.push({ x: r.x - 12, y: r.y - 12, w: r.w + 24, h: r.h + 24, isStep: true });
      } else if (r.isStair && !r.repairMode) {
        stepZones.push({ x: r.x - 8, y: r.y - 8, w: r.w + 16, h: r.h + 16, isStep: false });
      }
    });

    // Lối thông thẳng qua Sảnh thông báo ra Bậc thang Tượng Cụ (nếu không đang sửa)
    const stbStep = sheet.rooms.find(r => r.id === 'step_sanh_tb' && !r.repairMode);
    const stbRoom = sheet.rooms.find(r => r.id === 'sanh_thong_bao' && !r.repairMode);
    if (stbStep && stbRoom) {
      carveArea(852, 1255, 16, 170);
    }

    // 6. KHÓA LẠI VÙNG CẤM SÂN CHÀO CỜ & KHU VỰC ĐANG SỬA LÊN TRÊN CÙNG (Chống mọi trường hợp cắt góc!)
    if (startId !== 'cot_co' && endId !== 'cot_co') {
      markRect(780, 752, 160, 235, 8);
    }
    sheet.rooms.forEach(r => {
      if (r.repairMode) {
        markRect(r.x, r.y, r.w, r.h, 14);
      }
    });

    return { blocked, cols, rows, stepZones };
  }

  function findNearestFreeCell(grid, px, py) {
    const { blocked, cols, rows } = grid;
    const sc = Math.max(0, Math.min(cols - 1, Math.round(px / GRID_STEP)));
    const sr = Math.max(0, Math.min(rows - 1, Math.round(py / GRID_STEP)));
    if (!blocked[sr * cols + sc]) return { c: sc, r: sr };

    for (let rad = 1; rad <= 35; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
          const nc = sc + dc;
          const nr = sr + dr;
          if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !blocked[nr * cols + nc]) {
            return { c: nc, r: nr };
          }
        }
      }
    }
    return { c: sc, r: sr };
  }

  // 3. THUẬT TOÁN A* TÌM ĐƯỜNG NGẮN NHẤT VUÔNG GÓC (CHẠY TIM HÀNH LANG & SÂN TRỐNG)
  function aStarShortestPath(grid, ptA, ptB) {
    const { blocked, cols, rows } = grid;
    const s = findNearestFreeCell(grid, ptA.x, ptA.y);
    const e = findNearestFreeCell(grid, ptB.x, ptB.y);
    const startIdx = s.r * cols + s.c;
    const endIdx = e.r * cols + e.c;

    const gScore = new Float32Array(cols * rows).fill(Infinity);
    const cameFrom = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);

    const heap = [];
    function push(idx, f) {
      heap.push({ idx, f });
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        const t = heap[p]; heap[p] = heap[i]; heap[i] = t;
        i = p;
      }
    }
    function pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let l = 2 * i + 1, r = 2 * i + 2, sm = i;
          if (l < heap.length && heap[l].f < heap[sm].f) sm = l;
          if (r < heap.length && heap[r].f < heap[sm].f) sm = r;
          if (sm === i) break;
          const t = heap[i]; heap[i] = heap[sm]; heap[sm] = t;
          i = sm;
        }
      }
      return top;
    }

    gScore[startIdx] = 0;
    push(startIdx, Math.abs(s.c - e.c) + Math.abs(s.r - e.r));

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (heap.length > 0) {
      const cur = pop();
      const u = cur.idx;
      if (u === endIdx) break;
      if (closed[u]) continue;
      closed[u] = 1;

      const ur = Math.floor(u / cols);
      const uc = u % cols;
      const prev = cameFrom[u];
      const pr = prev >= 0 ? Math.floor(prev / cols) : -1;
      const pc = prev >= 0 ? (prev % cols) : -1;

      for (let d = 0; d < 4; d++) {
        const nc = uc + dirs[d][0];
        const nr = ur + dirs[d][1];
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const v = nr * cols + nc;
        if (blocked[v] || closed[v]) continue;

        // QUY TẮC ƯU TIÊN TUYẾN ĐƯỜNG:
        // Bậc thang (0.68) > Hành lang (0.76) > Bậc thang/Cầu thang (0.76) > Sân / Đường đi ngoại vi (1.28)
        const wx = nc * GRID_STEP;
        const wy = nr * GRID_STEP;
        const onCorridor =
          (wx >= 518 && wx <= 560 && wy >= 492 && wy <= 1282) ||
          (wx >= 1160 && wx <= 1202 && wy >= 360 && wy <= 1282) ||
          (wy >= 1240 && wy <= 1282 && wx >= 518 && wx <= 1202) ||
          (wy >= 678 && wy <= 720 && wx >= 518 && wx <= 1202) ||
          (wx >= 816 && wx <= 904 && wy >= 360 && wy <= 492);

        const inStepOrStair = (grid.stepZones || []).some(
          z => wx >= z.x && wx <= z.x + z.w && wy >= z.y && wy <= z.y + z.h
        );

        let cost = 1.28; // Mặc định: Sân trường / Đường đi ngoại vi
        if (onCorridor) cost = 0.76; // Hành lang được ưu tiên cao hơn sân/ngoại vi
        if (inStepOrStair) cost = 0.68; // Bậc thang & Cầu thang là cổng chuyển tiếp ưu tiên cao nhất

        if (prev >= 0 && (nc - uc !== uc - pc || nr - ur !== ur - pr)) {
          cost += 0.22; // Giữ đường đi vuông góc gọn gàng
        }

        const nextG = gScore[u] + cost;
        if (nextG < gScore[v]) {
          cameFrom[v] = u;
          gScore[v] = nextG;
          push(v, nextG + Math.abs(nc - e.c) + Math.abs(nr - e.r));
        }
      }
    }

    if (cameFrom[endIdx] === -1 && endIdx !== startIdx) {
      return { points: [], cost: Infinity, reachable: false };
    }

    const pts = [];
    let c = endIdx;
    while (c !== -1) {
      const r = Math.floor(c / cols);
      const col = c % cols;
      pts.push({ x: col * GRID_STEP, y: r * GRID_STEP });
      c = cameFrom[c];
    }
    pts.reverse();

    // Rút gọn điểm thẳng hàng
    const clean = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = clean[clean.length - 1];
      const b = pts[i];
      const next = pts[i + 1];
      const sameX = Math.abs(a.x - b.x) < 1 && Math.abs(b.x - next.x) < 1;
      const sameY = Math.abs(a.y - b.y) < 1 && Math.abs(b.y - next.y) < 1;
      if (!sameX && !sameY) clean.push(b);
    }
    if (pts.length > 1) clean.push(pts[pts.length - 1]);
    return { points: clean, cost: gScore[endIdx], reachable: true };
  }

  // 4. TÍNH TOÁN LỘ TRÌNH 1 CHẶNG (CÙNG TẦNG) HOẶC 2 CHẶNG (KHÁC TẦNG — KIỂU 2)
  function computeMultiLegRoute(sheet, roomA, roomB, subId) {
    const flA = normalizeFloor(roomA.floor);
    const flB = normalizeFloor(roomB.floor);

    const doorA = getRoomDoorOnCorridor(roomA, null);
    const edgeA = getRoomEdgeTouchPoint(roomA, doorA);
    const doorB = getRoomDoorOnCorridor(roomB, subId);
    const edgeB = subId ? doorB : getRoomEdgeTouchPoint(roomB, doorB);

    // A. CÙNG TẦNG
    if (flA === flB) {
      const grid = buildWalkableGrid(sheet, roomA.id, roomB.id, flA);
      const res = aStarShortestPath(grid, doorA, doorB);
      if (!res.reachable) return { blocked: true };
      const fullPts = [edgeA, ...res.points, edgeB];
      return {
        isMultiFloor: false,
        floorA: flA,
        floorB: flB,
        leg1Points: fullPts,
        leg1Meters: Math.max(5, Math.round(res.cost * 0.55)),
        leg2Points: null,
        leg2Meters: 0,
        stair: null,
        stairAction: null
      };
    }

    // B. KHÁC TẦNG: Chỉ xét các Cầu thang KHÔNG bị gắn tag "🔧 Đang sửa" (repairMode)!
    const workingStairs = sheet.rooms.filter(r => r.isStair && !r.repairMode);
    if (workingStairs.length === 0) {
      return { blocked: true, reason: 'Tất cả cầu thang hiện đang sửa chữa!' };
    }

    const gridA = buildWalkableGrid(sheet, roomA.id, null, flA);
    const gridB = buildWalkableGrid(sheet, null, roomB.id, flB);

    let bestTotal = Infinity;
    let bestStair = null;
    let bestLeg1 = null;
    let bestLeg2 = null;

    workingStairs.forEach(stRoom => {
      const stDoor = getRoomDoorOnCorridor(stRoom, null);
      const l1 = aStarShortestPath(gridA, doorA, stDoor);
      const l2 = aStarShortestPath(gridB, stDoor, doorB);
      if (l1.reachable && l2.reachable && (l1.cost + l2.cost) < bestTotal) {
        bestTotal = l1.cost + l2.cost;
        bestStair = stRoom;
        bestLeg1 = l1;
        bestLeg2 = l2;
      }
    });

    if (!bestStair) {
      return { blocked: true, reason: 'Không tìm thấy lối đi hợp lệ tránh khu vực đang sửa!' };
    }

    const rank = { TRET: 0, LAU1: 1, LAU2: 2 };
    const goingUp = (rank[flB] || 0) > (rank[flA] || 0);
    const stairAction = goingUp
      ? `⬆️ Lên ${floorDisplayName(flB)}`
      : `⬇️ Xuống ${floorDisplayName(flB)}`;

    return {
      isMultiFloor: true,
      floorA: flA,
      floorB: flB,
      stair: bestStair,
      stairAction,
      leg1Points: [edgeA, ...bestLeg1.points],
      leg1Meters: Math.max(4, Math.round(bestLeg1.cost * 0.55)),
      leg2Points: [...bestLeg2.points, edgeB],
      leg2Meters: Math.max(4, Math.round(bestLeg2.cost * 0.55))
    };
  }

  function ensureArrowMarkers(svg) {
    if (svg.querySelector('defs')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    const specs = [
      { id: 'nqd-arrow-red', fill: '#ef4444' },
      { id: 'nqd-arrow-blue', fill: '#0ea5e9' },
      { id: 'nqd-arrow-green', fill: '#10b981' }
    ];
    specs.forEach(sp => {
      const marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', sp.id);
      marker.setAttribute('viewBox', '0 0 12 12');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '6');
      marker.setAttribute('markerWidth', '5.5');
      marker.setAttribute('markerHeight', '5.5');
      marker.setAttribute('orient', 'auto-start-reverse');
      const poly = document.createElementNS(ns, 'path');
      poly.setAttribute('d', 'M 1 1 L 11 6 L 1 11 L 3.4 6 Z');
      poly.setAttribute('fill', sp.fill);
      poly.setAttribute('stroke', '#0f172a');
      poly.setAttribute('stroke-width', '0.9');
      marker.appendChild(poly);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);
  }

  function drawDirectionalChevrons(svg, points, fillColor) {
    const ns = 'http://www.w3.org/2000/svg';
    const spacing = 68;
    let distCarry = 34;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen < 1) continue;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      let pos = distCarry;
      while (pos < segLen - 18) {
        const t = pos / segLen;
        const cx = p1.x + dx * t;
        const cy = p1.y + dy * t;
        const tri = document.createElementNS(ns, 'path');
        tri.setAttribute('d', 'M -6 -5 L 6 0 L -6 5 L -3 0 Z');
        tri.setAttribute('fill', '#ffffff');
        tri.setAttribute('stroke', '#0f172a');
        tri.setAttribute('stroke-width', '1.4');
        tri.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`);
        svg.appendChild(tri);
        pos += spacing;
      }
      distCarry = Math.max(20, pos - segLen);
    }
  }

  function drawSvgPath(svg, points, casingCls, mainCls, customColor) {
    if (!points || points.length < 2) return;
    ensureArrowMarkers(svg);
    const ns = 'http://www.w3.org/2000/svg';
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const casing = document.createElementNS(ns, 'path');
    casing.setAttribute('d', d);
    casing.setAttribute('class', casingCls);
    svg.appendChild(casing);

    const main = document.createElementNS(ns, 'path');
    main.setAttribute('d', d);
    if (customColor) main.setAttribute('stroke', customColor);
    main.setAttribute('class', mainCls);

    // Gắn đầu mũi tên chỉ hướng ở cuối đường
    let markerId = 'nqd-arrow-red';
    if (customColor === '#0ea5e9') markerId = 'nqd-arrow-blue';
    else if (customColor && customColor !== '#ef4444') markerId = 'nqd-arrow-green';
    main.setAttribute('marker-end', `url(#${markerId})`);
    svg.appendChild(main);

    // Gắn thêm các mũi tên nhỏ dọc theo thân đường để nhìn rõ hướng A -> B
    drawDirectionalChevrons(svg, points, customColor || '#ef4444');
  }

  // 5. RENDER LỚP CHỈ ĐƯỜNG (KIỂU 2: CHẶNG 1 -> NÚT CHUYỂN TẦNG -> CHẶNG 2)
  function renderRoutingLayer() {
    const st = getState();
    const svg = document.getElementById('wayfinding-svg');
    const badges = document.getElementById('wayfinding-badges-layer');
    const banner = document.getElementById('active-route-banner');
    const stepControls = document.getElementById('route-leg-controls');
    if (!st || !svg || !badges) return;

    svg.innerHTML = '';
    badges.innerHTML = '';
    const sheet = getMap().getActiveSheet();

    // A. Line Cố Định Đặc Biệt của Sự kiện (D2)
    (sheet.fixedLines || []).forEach(fl => {
      const r1 = sheet.rooms.find(r => r.id === fl.from);
      const r2 = sheet.rooms.find(r => r.id === fl.to);
      if (!r1 || !r2 || r1.repairMode || r2.repairMode) return;
      const rt = computeMultiLegRoute(sheet, r1, r2, null);
      if (!rt || rt.blocked) return;
      drawSvgPath(svg, rt.leg1Points, 'fixed-event-line-casing', 'fixed-event-line-main', fl.color || '#10b981');
    });

    // B. Chỉ đường A -> B
    if (!st.pointA || !st.pointB) {
      st.activeStairId = null;
      lastRoutePairKey = '';
      currentLegStep = 1;
      if (banner) {
        banner.classList.add('hidden');
        banner.classList.remove('flex');
      }
      if (st.pointA) {
        const rA = sheet.rooms.find(r => r.id === st.pointA);
        if (rA) {
          addPin(badges, rA.x + rA.w / 2, rA.y + rA.h / 2, `📍 Điểm A: ${rA.name}`, 'bg-emerald-600 text-white');
        }
      }
      return;
    }

    const roomA = sheet.rooms.find(r => r.id === st.pointA);
    const roomB = sheet.rooms.find(r => r.id === st.pointB);
    if (!roomA || !roomB) return;

    // Chặn nếu điểm đến đang gắn tag "🔧 Đang sửa"
    if (roomB.repairMode) {
      notify(`🔧 Khu vực "${roomB.name}" đang sửa chữa, không thể dẫn đường vào!`);
      st.pointB = null;
      renderRoutingLayer();
      return;
    }

    // Reset về Chặng 1 khi người dùng đổi cặp điểm A/B mới
    const pairKey = `${st.pointA}__${st.pointB}__${targetSubBoothId || ''}`;
    if (pairKey !== lastRoutePairKey) {
      lastRoutePairKey = pairKey;
      currentLegStep = 1;
    }

    const effSub = roomB.interiorPublic ? targetSubBoothId : null;
    const route = computeMultiLegRoute(sheet, roomA, roomB, effSub);

    if (route.blocked) {
      notify(route.reason || 'Không tìm thấy lối đi tránh khu vực đang sửa!');
      return;
    }

    const prevStair = st.activeStairId;
    st.activeStairId = route.stair ? route.stair.id : null;
    if (prevStair !== st.activeStairId) {
      getMap().renderRooms();
    }

    // Hiển thị Banner dẫn đường
    banner.classList.remove('hidden');
    banner.classList.add('flex');

    if (!route.isMultiFloor) {
      // Cùng tầng: vẽ 1 chặng đỏ mượt mà
      drawSvgPath(svg, route.leg1Points, 'route-line-casing', 'route-line-main', '#ef4444');
      const pStart = route.leg1Points[0];
      const pEnd = route.leg1Points[route.leg1Points.length - 1];
      addPin(badges, pStart.x, pStart.y, `📍 A: ${roomA.name}`, 'bg-emerald-600 text-white');
      addPin(badges, pEnd.x, pEnd.y, `🚩 B: ${roomB.name}`, 'bg-rose-600 text-white');

      document.getElementById('route-banner-endpoints').textContent =
        `${roomA.name} ➔ ${roomB.name} (~${route.leg1Meters}m)`;
      document.getElementById('route-banner-sub').textContent =
        `Cùng tầng (${floorDisplayName(route.floorA)}) • Né Sân Chào Cờ & Khu đang sửa`;
      if (stepControls) stepControls.innerHTML = '';
    } else {
      // KHÁC TẦNG — KIỂU 2: CHỈ HIỆN ĐÚNG CHẶNG ĐANG ĐI (RẤT THOÁNG, KHÔNG RỐI MẮT!)
      const stCenter = { x: route.stair.x + route.stair.w / 2, y: route.stair.y + route.stair.h / 2 };

      if (currentLegStep === 1) {
        // CHẶNG 1: Từ Điểm A -> Cầu thang (Màu Xanh dương nổi bật)
        drawSvgPath(svg, route.leg1Points, 'route-line-casing', 'route-line-leg1', '#0ea5e9');
        const pStart = route.leg1Points[0];
        addPin(badges, pStart.x, pStart.y, `📍 A: ${roomA.name}`, 'bg-emerald-600 text-white');
        addPin(
          badges,
          stCenter.x,
          stCenter.y,
          `🪜 Chặng 1 kết thúc: ${route.stairAction}`,
          'bg-amber-400 text-slate-950 border-2 border-slate-950 animate-bounce'
        );

        document.getElementById('route-banner-endpoints').textContent =
          `Chặng 1/2 (${floorDisplayName(route.floorA)}): ${roomA.name} ➔ ${route.stair.name} (~${route.leg1Meters}m)`;
        document.getElementById('route-banner-sub').textContent =
          `Đi tới ${route.stair.name}, sau đó ${route.stairAction} để tới ${roomB.name}`;

        if (stepControls) {
          stepControls.innerHTML = '';
          const nextBtn = document.createElement('button');
          nextBtn.className = 'px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow transition';
          nextBtn.textContent = `🪜 Đã ${route.stairAction.replace(/^[^\s]+\s/, '')} ➔ Xem Chặng 2`;
          nextBtn.addEventListener('click', () => {
            currentLegStep = 2;
            // Tự động lọc bật sáng tầng đích để nhìn rõ phòng B ở Lầu 1/Lầu 2!
            st.activeFloor = route.floorB;
            getMap().render();
          });
          stepControls.appendChild(nextBtn);
        }
      } else {
        // CHẶNG 2: Từ Cầu thang -> Điểm B trên tầng đích (Màu Đỏ)
        drawSvgPath(svg, route.leg2Points, 'route-line-casing', 'route-line-main', '#ef4444');
        const pEnd = route.leg2Points[route.leg2Points.length - 1];
        addPin(
          badges,
          stCenter.x,
          stCenter.y,
          `🪜 Từ ${route.stair.name} (${floorDisplayName(route.floorB)})`,
          'bg-sky-500 text-white'
        );
        addPin(badges, pEnd.x, pEnd.y, `🚩 B: ${roomB.name}`, 'bg-rose-600 text-white');

        document.getElementById('route-banner-endpoints').textContent =
          `Chặng 2/2 (${floorDisplayName(route.floorB)}): ${route.stair.name} ➔ ${roomB.name} (~${route.leg2Meters}m)`;
        document.getElementById('route-banner-sub').textContent =
          `Đang hiển thị hành lang ${floorDisplayName(route.floorB)} dẫn vào ${roomB.name}`;

        if (stepControls) {
          stepControls.innerHTML = '';
          const backBtn = document.createElement('button');
          backBtn.className = 'px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition';
          backBtn.textContent = `⬅️ Xem lại Chặng 1 (${floorDisplayName(route.floorA)})`;
          backBtn.addEventListener('click', () => {
            currentLegStep = 1;
            st.activeFloor = route.floorA;
            getMap().render();
          });
          stepControls.appendChild(backBtn);
        }
      }
    }
  }

  function addPin(container, x, y, text, cls) {
    const el = document.createElement('div');
    el.style.left = x + 'px';
    el.style.top = (y - 18) + 'px';
    el.style.zIndex = '65';
    el.className = `absolute -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-full text-[11px] font-bold shadow-2xl border border-white/80 whitespace-nowrap ${cls}`;
    el.textContent = text;
    container.appendChild(el);
  }

  // 6. HỆ THỐNG 12 TRẠM MÃ QR 20M (?from=qr_tram_...) & "TÔI ĐANG Ở ĐÂU?"
  function drawQrMatrix(canvas, text) {
    const ctx = canvas.getContext('2d');
    const size = 21;
    const cell = Math.floor(canvas.width / size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';

    function finder(ox, oy) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            ctx.fillRect((ox + c) * cell, (oy + r) * cell, cell, cell);
          }
        }
      }
    }
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);

    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8)) continue;
        hash ^= (r * 31 + c * 17);
        hash = Math.imul(hash, 16777619);
        if ((Math.abs(hash) % 10) < 5) {
          ctx.fillRect(c * cell, r * cell, cell, cell);
        }
      }
    }
  }

  function openQrStationsModal() {
    const modal = document.getElementById('qr-stations-modal');
    const list = document.getElementById('qr-stations-list');
    if (!modal || !list) return;
    list.innerHTML = '';

    QR_STATIONS.forEach(stItem => {
      const url = `${window.location.origin}${window.location.pathname}?from=${stItem.qrId}`;
      const row = document.createElement('div');
      row.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2';
      row.innerHTML = `
        <div class="min-w-0">
          <div class="text-xs font-bold text-white truncate">${stItem.label}</div>
          <div class="text-[10px] text-sky-400 truncate">${stItem.zone} • ?from=${stItem.qrId}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button class="qr-sim-btn px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">📲 Quét thử</button>
          <button class="qr-view-btn px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold">🖨️ Ảnh QR</button>
        </div>
      `;
      row.querySelector('.qr-sim-btn').addEventListener('click', () => {
        getState().pointA = stItem.roomId;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        getMap().focusOnRoom(stItem.roomId);
        renderRoutingLayer();
      });
      row.querySelector('.qr-view-btn').addEventListener('click', () => {
        const box = document.getElementById('qr-single-preview');
        box.classList.remove('hidden');
        document.getElementById('qr-single-title').textContent = stItem.label;
        document.getElementById('qr-single-url').textContent = url;
        drawQrMatrix(document.getElementById('qr-single-canvas'), url);
      });
      list.appendChild(row);
    });

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function openWhereAmIModal() {
    const modal = document.getElementById('where-am-i-modal');
    const grid = document.getElementById('where-qr-grid');
    const sel = document.getElementById('where-room-select');
    if (!modal || !grid || !sel) return;

    grid.innerHTML = '';
    QR_STATIONS.forEach((stItem, idx) => {
      const btn = document.createElement('button');
      btn.className = 'p-2 rounded-xl bg-slate-950 hover:bg-emerald-600/30 border border-slate-800 hover:border-emerald-500 text-left transition';
      btn.innerHTML = `
        <div class="text-[11px] font-bold text-amber-300">Trạm ${String(idx + 1).padStart(2, '0')}</div>
        <div class="text-[10px] text-slate-300 truncate">${stItem.zone}</div>
      `;
      btn.addEventListener('click', () => {
        getState().pointA = stItem.roomId;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        getMap().focusOnRoom(stItem.roomId);
        renderRoutingLayer();
      });
      grid.appendChild(btn);
    });

    sel.innerHTML = '';
    const sheet = getMap().getActiveSheet();
    sheet.rooms.forEach(r => sel.add(new Option(r.name, r.id)));

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function handleUrlFromParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get('from');
      if (!fromParam) return;
      const station = QR_STATIONS.find(s => s.qrId === fromParam);
      const targetId = station ? station.roomId : fromParam;
      const sheet = getMap().getActiveSheet();
      const matched = sheet.rooms.find(r => r.id === targetId);
      if (matched) {
        getState().pointA = matched.id;
        getMap().focusOnRoom(matched.id);
        renderRoutingLayer();
      }
    } catch (e) {}
  }

  function initRouting() {
    document.getElementById('btn-open-where-am-i')?.addEventListener('click', openWhereAmIModal);
    document.getElementById('btn-close-where-am-i')?.addEventListener('click', () => {
      const m = document.getElementById('where-am-i-modal');
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
    document.getElementById('btn-confirm-where-room')?.addEventListener('click', () => {
      const id = document.getElementById('where-room-select').value;
      if (!id) return;
      getState().pointA = id;
      const m = document.getElementById('where-am-i-modal');
      m.classList.add('hidden');
      m.classList.remove('flex');
      getMap().focusOnRoom(id);
      renderRoutingLayer();
    });

    document.getElementById('btn-open-qr-stations')?.addEventListener('click', openQrStationsModal);
    document.getElementById('btn-close-qr-stations')?.addEventListener('click', () => {
      const m = document.getElementById('qr-stations-modal');
      m.classList.add('hidden');
      m.classList.remove('flex');
    });

    document.getElementById('btn-clear-active-route')?.addEventListener('click', () => {
      const st = getState();
      st.pointA = null;
      st.pointB = null;
      st.activeStairId = null;
      st.activeFloor = 'ALL';
      targetSubBoothId = null;
      currentLegStep = 1;
      lastRoutePairKey = '';
      getMap().render();
    });

    document.getElementById('rooms-layer')?.addEventListener('pointerdown', (e) => {
      const subEl = e.target.closest('.subbooth-item');
      if (!subEl) {
        targetSubBoothId = null;
        return;
      }
      e.stopPropagation();
      const parentEl = subEl.closest('.room-block');
      if (!parentEl) return;
      targetSubBoothId = subEl.dataset.subboothId;
      const st = getState();
      if (!st.pointA) st.pointA = 'cong_chinh';
      st.pointB = parentEl.dataset.roomId;
      getMap().render();
    });

    handleUrlFromParam();
    renderRoutingLayer();
  }

  window.NQDRouting = {
    QR_STATIONS,
    render: renderRoutingLayer,
    openWhereAmIModal,
    openQrStationsModal,
    init: initRouting
  };
})(window);

  </script>

  <!-- MODULE 4: STREETVIEW.JS -->
  <script>
/**
 * ============================================================================
 * PHẦN 4: MODULE STREET VIEW THỰC TẾ ẢO (streetview.js)
 * Dự án KHKT: Bản đồ số tương tác & Điều hướng sự kiện THPT Chuyên Nguyễn Quang Diêu
 * - Hỗ trợ ảnh Panorama dải rộng chụp điện thoại (180°-240°) & ảnh 360°
 * - Khởi tạo sẵn 33 điểm đứng theo đúng 3 tầng (Trệt, Lầu 1, Lầu 2)
 * - Chế độ Admin Ghép Thủ Công Trực Tiếp:
 *   + Chấm điểm đứng mới ngay trên Bản đồ 2D
 *   + Gắn đường dẫn ảnh GitHub (panoramas/ten_anh.jpg), link ngoài hoặc test file từ máy
 *   + Bấm trực tiếp lên mặt đường trong ảnh Panorama để đặt Mũi tên chuyển cảnh
 * - Đồng bộ toàn bộ cấu trúc điểm đứng & mũi tên lên Firebase nqd-map2-default-rtdb
 * ============================================================================
 */
(function (window) {
  'use strict';

  function createDefaultStreetViewNodes() {
    return [
      // ==================== TẦNG TRỆT (MẶT TIỀN, VÒNG CUNG LỚN, SẢNH & SÂN CỜ) ====================
      {
        id: 'sv_tuong_cu',
        name: 'Tượng Cụ',
        floor: 'TRET',
        x: 860,
        y: 1476,
        img: "user_uploaded_files/ttl=63d/user_uploaded/image_c8c3c6.jpg",
        is360: false,
        arrows: [
          { id: 'ar_tc_1', x: 39, y: 68, targetId: 'sv_sanh_thong_tin', icon: '⬆️', label: 'Vào Sảnh thông tin' },
          { id: 'ar_tc_2', x: 11, y: 70, targetId: 'sv_trai_tuong_cu', icon: '⬅️', label: 'Trái Tượng Cụ' },
          { id: 'ar_tc_3', x: 74, y: 70, targetId: 'sv_phai_tuong_cu', icon: '➡️', label: 'Phải Tượng Cụ' }
        ]
      },
      { id: 'sv_trai_tuong_cu', name: 'Trái Tượng Cụ', floor: 'TRET', x: 720, y: 1476, img: '', is360: false, arrows: [] },
      { id: 'sv_phai_tuong_cu', name: 'Phải Tượng Cụ', floor: 'TRET', x: 1000, y: 1476, img: '', is360: false, arrows: [] },
      { id: 'sv_goc_trai_san', name: 'Góc trái sân (lệch trái Tượng Cụ)', floor: 'TRET', x: 540, y: 1480, img: '', is360: false, arrows: [] },
      { id: 'sv_ao_sen', name: 'Khu Ao sen & lệch phải Sảnh Thư viện', floor: 'TRET', x: 465, y: 1435, img: '', is360: false, arrows: [] },
      { id: 'sv_truoc_nha_xe_tv', name: 'Trước Nhà xe HS (lệch trái Sảnh Thư viện)', floor: 'TRET', x: 270, y: 1290, img: '', is360: false, arrows: [] },
      { id: 'sv_truoc_nha_xe_av', name: 'Trước Nhà xe HS (đối diện Sảnh AV)', floor: 'TRET', x: 270, y: 950, img: '', is360: false, arrows: [] },
      { id: 'sv_trong_nha_xe', name: 'Trong Nhà xe học sinh', floor: 'TRET', x: 164, y: 735, img: '', is360: false, arrows: [] },
      { id: 'sv_trai_nha_xe_vr', name: 'Trái Nhà xe HS (góc lệch phải Vườn rau)', floor: 'TRET', x: 270, y: 420, img: '', is360: false, arrows: [] },
      { id: 'sv_sau_vuon_rau', name: 'Sau Vườn rau (đối diện Sân bóng & Cầu lông)', floor: 'TRET', x: 560, y: 180, img: '', is360: false, arrows: [] },
      { id: 'sv_truoc_san_bong', name: 'Trực diện trước Sân bóng đá', floor: 'TRET', x: 565, y: 112, img: '', is360: false, arrows: [] },
      { id: 'sv_vong_cung_lon', name: 'Vòng cung lớn (Đường sau Sân bóng)', floor: 'TRET', x: 1020, y: 55, img: '', is360: false, arrows: [] },
      { id: 'sv_ra_vong_cung', name: 'Khu đường đi ra Vòng cung lớn', floor: 'TRET', x: 1225, y: 120, img: '', is360: false, arrows: [] },
      { id: 'sv_lech_phai_ntd', name: 'Lệch phải Nhà thi đấu', floor: 'TRET', x: 1530, y: 225, img: '', is360: false, arrows: [] },
      { id: 'sv_sau_ntd_ktx', name: 'Sau Nhà thi đấu (lệch phải KTX lớn)', floor: 'TRET', x: 1685, y: 390, img: '', is360: false, arrows: [] },
      { id: 'sv_truoc_ktx_lon', name: 'Trước Ký túc xá lớn', floor: 'TRET', x: 1585, y: 580, img: '', is360: false, arrows: [] },
      { id: 'sv_htl_ben_trai', name: 'Hội trường lớn (bên trái)', floor: 'TRET', x: 1418, y: 1020, img: '', is360: false, arrows: [] },
      { id: 'sv_nha_xe_gv_htl', name: 'Bên phải Nhà xe GV (lệch trái Hội trường lớn)', floor: 'TRET', x: 1440, y: 1425, img: '', is360: false, arrows: [] },
      { id: 'sv_4_cot_tru', name: '4 Cột trụ tri thức (đối diện Hội trường lớn)', floor: 'TRET', x: 1265, y: 1365, img: '', is360: false, arrows: [] },
      { id: 'sv_sanh_thong_tin', name: 'Sảnh thông tin', floor: 'TRET', x: 860, y: 1375, img: '', is360: false, arrows: [] },
      { id: 'sv_hl_trai_stt', name: 'Hành lang trái Sảnh thông tin', floor: 'TRET', x: 680, y: 1260, img: '', is360: false, arrows: [] },
      { id: 'sv_sanh_thu_vien', name: 'Sảnh Thư viện', floor: 'TRET', x: 424, y: 1373, img: '', is360: false, arrows: [] },
      { id: 'sv_sanh_av', name: 'Sảnh AV', floor: 'TRET', x: 538, y: 960, img: '', is360: false, arrows: [] },
      { id: 'sv_hl_phai_stt', name: 'Hành lang phải Sảnh thông tin', floor: 'TRET', x: 1040, y: 1260, img: '', is360: false, arrows: [] },
      { id: 'sv_phong_bo_mon', name: 'Các phòng bộ môn', floor: 'TRET', x: 1180, y: 1020, img: '', is360: false, arrows: [] },
      { id: 'sv_cot_co', name: 'Vị trí Cột cờ (nhìn thẳng Sảnh Chào Cờ)', floor: 'TRET', x: 860, y: 946, img: '', is360: false, arrows: [] },
      { id: 'sv_san_co_trai', name: 'Bên trái Sân cờ', floor: 'TRET', x: 690, y: 946, img: '', is360: false, arrows: [] },
      { id: 'sv_san_co_phai', name: 'Bên phải Sân cờ', floor: 'TRET', x: 1030, y: 946, img: '', is360: false, arrows: [] },

      // ==================== LẦU 1 (TẦNG 2) ====================
      { id: 'sv_l1_htn', name: 'Hội trường nhỏ (Lầu 1)', floor: 'LAU1', x: 860, y: 1313, img: '', is360: false, arrows: [] },
      { id: 'sv_l1_thu_vien', name: 'Thư viện (Lầu 1)', floor: 'LAU1', x: 424, y: 1283, img: '', is360: false, arrows: [] },
      { id: 'sv_l1_lancan_scc', name: 'Lan can Sảnh Chào Cờ (Lầu 1)', floor: 'LAU1', x: 860, y: 650, img: '', is360: false, arrows: [] },
      { id: 'sv_l1_hl_lop', name: 'Hành lang lớp học (Lầu 1)', floor: 'LAU1', x: 690, y: 585, img: '', is360: false, arrows: [] },

      // ==================== LẦU 2 (TẦNG 3) ====================
      { id: 'sv_l2_lancan_scc', name: 'Lan can Sảnh Chào Cờ (Lầu 2)', floor: 'LAU2', x: 860, y: 523, img: '', is360: false, arrows: [] }
    ];
  }

  let showPinsOnMap = false;
  let adminStreetTabActive = false;
  let activeNodeId = null;
  let pickNewNodeMode = false;
  let placeArrowMode = false;
  let pendingArrowPos = null; // { x: pct, y: pct }

  // Panorama Viewer Pan/Zoom State
  let panoZoom = 1.0;
  let panoOffsetX = 0; // pixels
  let panoOffsetY = 0;
  let panoImgNaturalW = 0;
  let panoImgNaturalH = 0;

  function getMap() { return window.NQDMap; }
  function getState() { return window.NQDMap ? window.NQDMap.state : null; }

  function ensureNodesInitialized() {
    const st = getState();
    if (!st) return [];
    if (!Array.isArray(st.streetViewNodes) || st.streetViewNodes.length === 0) {
      st.streetViewNodes = createDefaultStreetViewNodes();
    }
    return st.streetViewNodes;
  }

  function notify(msg) {
    const t = document.getElementById('admin-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(window.__svToastTimer);
    window.__svToastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  function floorLabel(fl) {
    if (fl === 'LAU1') return 'Lầu 1 (Tầng 2)';
    if (fl === 'LAU2') return 'Lầu 2 (Tầng 3)';
    return 'Trệt (Tầng 1)';
  }

  // 1. RENDER CÁC CHẤM TRÒN STREET VIEW NGAY TRÊN BẢN ĐỒ 2D
  function renderMapPins() {
    const layer = document.getElementById('streetview-pins-layer');
    if (!layer) return;
    layer.innerHTML = '';

    const st = getState();
    const nodes = ensureNodesInitialized();
    const isAdmin = st.adminRole === 'FA';

    // Mặc định KHÔNG đè bất kỳ chấm tròn Street View nào lên Map Gốc;
    // Chỉ hiện chấm vị trí khi Admin đang mở đúng tab 🌐 Street hoặc người dùng chủ động bật
    if (!showPinsOnMap && !(isAdmin && adminStreetTabActive)) return;

    nodes.forEach(node => {
      const hasImg = !!(node.img && node.img.trim() !== '');
      // Khách xem chỉ thấy những điểm đã có ảnh; Full Admin thấy toàn bộ để ghép thủ công
      if (!hasImg && !isAdmin) return;
      // Lọc theo tầng nếu đang chọn bộ lọc tầng cụ thể
      if (st.activeFloor !== 'ALL' && st.activeFloor !== 'HANHCHINH' && node.floor !== st.activeFloor) {
        if (!isAdmin) return;
      }

      const pin = document.createElement('button');
      pin.style.left = node.x + 'px';
      pin.style.top = node.y + 'px';
      pin.title = `${node.name} (${floorLabel(node.floor)})`;
      pin.className = `sv-map-pin absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full shadow-lg border-2 transition transform hover:scale-125 pointer-events-auto ${
        hasImg
          ? 'w-8 h-8 bg-sky-500 border-white text-white text-xs z-30'
          : 'w-6 h-6 bg-slate-900/85 border-dashed border-amber-400 text-amber-300 text-[10px] z-25 opacity-80'
      } ${activeNodeId === node.id ? 'ring-4 ring-amber-400 scale-125' : ''}`;
      pin.textContent = hasImg ? '📷' : '＋';

      pin.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        activeNodeId = node.id;
        refreshAdminStreetViewTab();
        renderMapPins();
        if (hasImg || isAdmin) {
          openViewer(node.id);
        }
      });

      layer.appendChild(pin);
    });
  }

  // 2. MỞ TRÌNH XEM STREET VIEW PANORAMA (FULLSCREEN MOBILE-FIRST)
  function openViewer(nodeId) {
    const nodes = ensureNodesInitialized();
    const node = nodes.find(n => n.id === nodeId) || nodes.find(n => n.img && n.img.trim() !== '') || nodes[0];
    if (!node) return;

    activeNodeId = node.id;
    placeArrowMode = false;
    pendingArrowPos = null;
    document.getElementById('sv-arrow-creator-box')?.classList.add('hidden');

    const modal = document.getElementById('streetview-viewer-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    renderViewerScene(node);
    refreshAdminStreetViewTab();
  }

  function closeViewer() {
    const modal = document.getElementById('streetview-viewer-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    placeArrowMode = false;
    pendingArrowPos = null;
    renderMapPins();
  }

  function renderViewerScene(node) {
    const st = getState();
    const isAdmin = st.adminRole === 'FA';

    document.getElementById('sv-viewer-title').textContent = node.name;
    document.getElementById('sv-viewer-floor-badge').textContent = floorLabel(node.floor);

    // Thanh công cụ Admin ngay trên trình xem (chỉ hiện với Full Admin)
    const admToolbar = document.getElementById('sv-viewer-admin-bar');
    admToolbar.classList.toggle('hidden', !isAdmin);
    admToolbar.classList.toggle('flex', isAdmin);
    updatePlaceArrowButtonUI();

    const emptyNotice = document.getElementById('sv-empty-photo-state');
    const stageWrap = document.getElementById('sv-pano-stage');
    const imgEl = document.getElementById('sv-pano-image');

    const hasImg = !!(node.img && node.img.trim() !== '');
    if (!hasImg) {
      emptyNotice.classList.remove('hidden');
      emptyNotice.classList.add('flex');
      stageWrap.classList.add('hidden');
      document.getElementById('sv-empty-node-name').textContent = node.name;
    } else {
      emptyNotice.classList.add('hidden');
      emptyNotice.classList.remove('flex');
      stageWrap.classList.remove('hidden');

      imgEl.onload = () => {
        panoImgNaturalW = imgEl.naturalWidth || 2400;
        panoImgNaturalH = imgEl.naturalHeight || 600;
        resetPanoCamera();
        renderViewerArrows(node);
      };
      imgEl.onerror = () => {
        notify('Không tải được ảnh: ' + node.img);
      };
      imgEl.src = node.img;
      // Nếu ảnh đã cache sẵn
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        panoImgNaturalW = imgEl.naturalWidth;
        panoImgNaturalH = imgEl.naturalHeight;
        resetPanoCamera();
        renderViewerArrows(node);
      }
    }

    renderViewerMiniMap(node);
  }

  // 3. CAMERA PANORAMA MƯỢT (HỖ TRỢ TỰ KHÓA VIỀN CHO ẢNH ĐIỆN THOẠI 180°-240°)
  function resetPanoCamera() {
    const viewport = document.getElementById('sv-pano-viewport');
    const vw = viewport.clientWidth || window.innerWidth;
    const vh = viewport.clientHeight || window.innerHeight;
    panoZoom = 1.0;

    // Fit chiều cao ảnh vừa khít khung nhìn để tạo hiệu ứng góc nhìn ngang thực tế
    const aspect = panoImgNaturalW / Math.max(1, panoImgNaturalH);
    const displayH = Math.max(vh, 320);
    const displayW = Math.max(vw, displayH * aspect);

    const canvas = document.getElementById('sv-pano-canvas-box');
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';

    // Đặt tâm nhìn ban đầu ở giữa ảnh (chính diện)
    panoOffsetX = Math.round((vw - displayW) / 2);
    panoOffsetY = Math.round((vh - displayH) / 2);
    applyPanoTransform();
  }

  function applyPanoTransform() {
    const viewport = document.getElementById('sv-pano-viewport');
    const canvas = document.getElementById('sv-pano-canvas-box');
    if (!viewport || !canvas) return;

    const vw = viewport.clientWidth || window.innerWidth;
    const vh = viewport.clientHeight || window.innerHeight;
    const baseW = parseFloat(canvas.style.width) || vw;
    const baseH = parseFloat(canvas.style.height) || vh;
    const scaledW = baseW * panoZoom;
    const scaledH = baseH * panoZoom;

    // Khóa viền mượt để không bao giờ hở khoảng đen hai bên (Partial Panorama Clamp)
    const minX = Math.min(0, vw - scaledW);
    const maxX = Math.max(0, (vw - scaledW) / 2);
    const minY = Math.min(0, vh - scaledH);
    const maxY = Math.max(0, (vh - scaledH) / 2);

    panoOffsetX = Math.max(minX, Math.min(maxX, panoOffsetX));
    panoOffsetY = Math.max(minY, Math.min(maxY, panoOffsetY));

    canvas.style.transform = `translate3d(${panoOffsetX}px, ${panoOffsetY}px, 0) scale(${panoZoom})`;

    // Cập nhật góc xoay la bàn (Compass)
    const progress = scaledW > vw ? (-panoOffsetX / (scaledW - vw)) : 0.5;
    const deg = Math.round((progress - 0.5) * 180);
    const comp = document.getElementById('sv-compass-deg');
    if (comp) comp.textContent = `${deg >= 0 ? '+' : ''}${deg}°`;
  }

  // 4. VẼ CÁC MŨI TÊN CHUYỂN CẢNH (HOTSPOTS) NỔI TRỰC TIẾP TRÊN ẢNH PANORAMA
  function renderViewerArrows(node) {
    const layer = document.getElementById('sv-pano-arrows-layer');
    if (!layer) return;
    layer.innerHTML = '';

    const st = getState();
    const isAdmin = st.adminRole === 'FA';
    const allNodes = ensureNodesInitialized();

    (node.arrows || []).forEach(ar => {
      const target = allNodes.find(n => n.id === ar.targetId);
      const targetHasImg = !!(target && target.img && target.img.trim() !== '');

      const wrap = document.createElement('div');
      wrap.style.left = ar.x + '%';
      wrap.style.top = ar.y + '%';
      wrap.className = 'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-20 pointer-events-auto';

      const btn = document.createElement('button');
      btn.className = `group px-3.5 py-2 rounded-2xl border-2 shadow-2xl backdrop-blur-md flex items-center gap-1.5 transition transform hover:scale-110 active:scale-95 ${
        targetHasImg
          ? 'bg-sky-600/90 hover:bg-sky-500 border-white text-white'
          : 'bg-slate-900/85 hover:bg-slate-800 border-amber-400/80 text-amber-200'
      }`;
      btn.innerHTML = `
        <span class="text-base leading-none">${ar.icon || '⬆️'}</span>
        <span class="text-xs font-bold whitespace-nowrap drop-shadow">${ar.label || (target ? target.name : 'Đi tiếp')}</span>
      `;

      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!target) return;
        if (!targetHasImg && !isAdmin) {
          notify(`Khu vực "${target.name}" đang được cập nhật ảnh thực tế.`);
          return;
        }
        openViewer(target.id);
      });
      wrap.appendChild(btn);

      // Nút xóa nhanh mũi tên khi đang bật chế độ Admin Chấm Mũi Tên
      if (isAdmin && placeArrowMode) {
        const del = document.createElement('button');
        del.className = 'px-2 py-0.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow';
        del.textContent = '✖ Xóa';
        del.addEventListener('pointerdown', (e) => e.stopPropagation());
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          node.arrows = node.arrows.filter(x => x.id !== ar.id);
          getMap().saveStorage();
          renderViewerArrows(node);
          refreshAdminStreetViewTab();
        });
        wrap.appendChild(del);
      }

      layer.appendChild(wrap);
    });
  }

  // 5. MINI-MAP THU NHỎ TRONG TRÌNH XEM STREET VIEW (CHUYỂN ĐIỂM & CHUYỂN TẦNG NHANH)
  function renderViewerMiniMap(activeNode) {
    const list = document.getElementById('sv-minimap-nodes');
    if (!list) return;
    list.innerHTML = '';

    const st = getState();
    const isAdmin = st.adminRole === 'FA';
    const nodes = ensureNodesInitialized();

    const filtered = nodes.filter(n => n.floor === activeNode.floor && (isAdmin || (n.img && n.img.trim() !== '')));
    filtered.forEach(n => {
      const btn = document.createElement('button');
      const isCur = n.id === activeNode.id;
      const hasImg = !!(n.img && n.img.trim() !== '');
      btn.className = `px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition shrink-0 flex items-center gap-1 ${
        isCur
          ? 'bg-amber-400 text-slate-950 shadow'
          : (hasImg ? 'bg-slate-800 hover:bg-sky-600 text-white' : 'bg-slate-900/90 text-slate-400 border border-dashed border-slate-700')
      }`;
      btn.innerHTML = `<span>${hasImg ? '📷' : '○'}</span><span>${n.name}</span>`;
      btn.addEventListener('click', () => openViewer(n.id));
      list.appendChild(btn);
    });

    // Cập nhật trạng thái nút chuyển tầng nhanh trong Mini-Map
    document.querySelectorAll('.sv-viewer-floor-btn').forEach(b => {
      const on = b.dataset.floor === activeNode.floor;
      b.className = `sv-viewer-floor-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
        on ? 'bg-sky-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
      }`;
    });
  }

  // 6. THAO TÁC VUỐT XOAY PANORAMA & CHẤM MŨI TÊN THỦ CÔNG NGAY TRÊN ẢNH
  function initViewerGestures() {
    const vp = document.getElementById('sv-pano-viewport');
    const canvasBox = document.getElementById('sv-pano-canvas-box');
    if (!vp || !canvasBox) return;

    let dragging = false;
    let sx = 0, sy = 0;
    let ox = 0, oy = 0;
    let movedDist = 0;

    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.closest('#sv-arrow-creator-box')) return;
      dragging = true;
      movedDist = 0;
      sx = e.clientX;
      sy = e.clientY;
      ox = panoOffsetX;
      oy = panoOffsetY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      movedDist += Math.abs(dx) + Math.abs(dy);
      panoOffsetX = ox + dx;
      panoOffsetY = oy + dy;
      applyPanoTransform();
    });

    window.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;

      // Nếu đang bật chế độ Admin Chấm Mũi Tên và người dùng click (không phải kéo xoay)
      if (placeArrowMode && movedDist < 12 && getState().adminRole === 'FA') {
        const rect = canvasBox.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const xPct = Math.max(3, Math.min(97, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
          const yPct = Math.max(8, Math.min(92, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
          openArrowCreatorAt(xPct, yPct);
        }
      }
    });

    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      panoZoom = Math.max(1.0, Math.min(2.6, panoZoom * factor));
      applyPanoTransform();
    }, { passive: false });
  }

  function updatePlaceArrowButtonUI() {
    const btn = document.getElementById('btn-sv-toggle-place-arrow');
    if (!btn) return;
    btn.className = placeArrowMode
      ? 'px-3 py-1.5 rounded-xl bg-fuchsia-600 text-white text-xs font-bold shadow animate-pulse'
      : 'px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-fuchsia-600 text-fuchsia-300 hover:text-white border border-fuchsia-500/40 text-xs font-bold transition';
    btn.textContent = placeArrowMode ? '🎯 Đang chấm: Bấm lên mặt đường trong ảnh' : '🎯 Chấm mũi tên lên ảnh';
  }

  function openArrowCreatorAt(xPct, yPct) {
    pendingArrowPos = { x: xPct, y: yPct };
    const box = document.getElementById('sv-arrow-creator-box');
    const sel = document.getElementById('sv-new-arrow-target');
    const nodes = ensureNodesInitialized();

    sel.innerHTML = '';
    nodes.forEach(n => {
      if (n.id === activeNodeId) return;
      const prefix = n.img ? '📷 ' : '○ ';
      sel.add(new Option(`${prefix}${n.name} [${floorLabel(n.floor)}]`, n.id));
    });

    document.getElementById('sv-new-arrow-label').value = '';
    box.classList.remove('hidden');
  }

  // 7. TAB QUẢN TRỊ STREET VIEW TRONG BẢNG ADMIN STUDIO 6/4
  function refreshAdminStreetViewTab() {
    const st = getState();
    if (!st || st.adminRole !== 'FA') return;

    const nodes = ensureNodesInitialized();
    const listEl = document.getElementById('adm-sv-nodes-list');
    const countEl = document.getElementById('adm-sv-stats');
    if (!listEl) return;

    const withPhoto = nodes.filter(n => n.img && n.img.trim() !== '').length;
    if (countEl) countEl.textContent = `${withPhoto}/${nodes.length} điểm đã có ảnh`;

    listEl.innerHTML = '';
    nodes.forEach(n => {
      const hasImg = !!(n.img && n.img.trim() !== '');
      const isSel = n.id === activeNodeId;
      const row = document.createElement('button');
      row.className = `w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition ${
        isSel
          ? 'bg-sky-600 text-white font-bold shadow'
          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
      }`;
      row.innerHTML = `
        <span class="truncate">${hasImg ? '📷' : '○'} ${n.name}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/70 text-amber-300 shrink-0">${n.floor} (${(n.arrows || []).length}➔)</span>
      `;
      row.addEventListener('click', () => {
        activeNodeId = n.id;
        refreshAdminStreetViewTab();
        renderMapPins();
      });
      listEl.appendChild(row);
    });

    const node = nodes.find(n => n.id === activeNodeId) || nodes[0];
    if (!node) return;
    activeNodeId = node.id;

    document.getElementById('adm-sv-name').value = node.name || '';
    document.getElementById('adm-sv-floor').value = node.floor || 'TRET';
    document.getElementById('adm-sv-img-path').value = node.img && node.img.startsWith('data:') ? '[Ảnh test cục bộ]' : (node.img || '');

    // Render danh sách mũi tên của điểm đang chọn để đổi tên / icon tùy ý trực tiếp
    const arrowsBox = document.getElementById('adm-sv-arrows-list');
    if (arrowsBox) {
      arrowsBox.innerHTML = '';
      const arrs = node.arrows || [];
      if (arrs.length === 0) {
        arrowsBox.innerHTML = '<div class="text-[11px] text-slate-500 italic px-1">Chưa có mũi tên nào ở điểm này.</div>';
      } else {
        arrs.forEach(ar => {
          const row = document.createElement('div');
          row.className = 'flex items-center gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800';
          row.innerHTML = `
            <select class="ar-icon-sel bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-xs text-white">
              <option value="⬆️" ${ar.icon === '⬆️' ? 'selected' : ''}>⬆️</option>
              <option value="⬅️" ${ar.icon === '⬅️' ? 'selected' : ''}>⬅️</option>
              <option value="➡️" ${ar.icon === '➡️' ? 'selected' : ''}>➡️</option>
              <option value="↩️" ${ar.icon === '↩️' ? 'selected' : ''}>↩️</option>
              <option value="🪜" ${ar.icon === '🪜' ? 'selected' : ''}>🪜</option>
            </select>
            <input type="text" value="${(ar.label || '').replace(/"/g, '&quot;')}" placeholder="Tên hiển thị trên mũi tên..." class="ar-label-in flex-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs text-white" />
            <button class="ar-del-btn px-1.5 text-rose-400 hover:text-rose-300 text-xs font-bold">✖</button>
          `;
          row.querySelector('.ar-icon-sel').addEventListener('change', (e) => {
            ar.icon = e.target.value;
            getMap().saveStorage();
            renderViewerArrows(node);
          });
          row.querySelector('.ar-label-in').addEventListener('input', (e) => {
            ar.label = e.target.value;
            getMap().saveStorage();
            renderViewerArrows(node);
          });
          row.querySelector('.ar-del-btn').addEventListener('click', () => {
            node.arrows = node.arrows.filter(x => x.id !== ar.id);
            getMap().saveStorage();
            renderViewerArrows(node);
            refreshAdminStreetViewTab();
          });
          arrowsBox.appendChild(row);
        });
      }
    }
  }

  // 8. KHỞI TẠO TOÀN BỘ SỰ KIỆN CHO MODULE STREETVIEW.JS
  function initStreetView() {
    ensureNodesInitialized();

    // Nút 🌐 Street View trên thanh công cụ chính
    document.getElementById('btn-open-streetview')?.addEventListener('click', () => {
      const nodes = ensureNodesInitialized();
      const firstReady = nodes.find(n => n.img && n.img.trim() !== '') || nodes[0];
      if (firstReady) openViewer(firstReady.id);
    });

    // Bật/tắt chế độ Chấm điểm mới trên Bản đồ 2D khi ở Admin
    document.getElementById('btn-adm-sv-pick-map')?.addEventListener('click', (e) => {
      pickNewNodeMode = !pickNewNodeMode;
      e.currentTarget.className = pickNewNodeMode
        ? 'flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold animate-pulse'
        : 'flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold';
      e.currentTarget.textContent = pickNewNodeMode ? '📍 Hãy bấm lên Bản đồ 2D...' : '＋ Chấm điểm trên Map';
    });

    // Bắt sự kiện click lên Bản đồ 2D để tạo điểm Street View mới tại tọa độ thực
    document.getElementById('map-viewport')?.addEventListener('click', (e) => {
      if (!pickNewNodeMode || getState().adminRole !== 'FA') return;
      if (e.target.closest('button')) return;
      const world = document.getElementById('map-world');
      const rect = world.getBoundingClientRect();
      const st = getState();
      const mx = Math.round((e.clientX - rect.left) / st.zoom);
      const my = Math.round((e.clientY - rect.top) / st.zoom);

      const nodes = ensureNodesInitialized();
      const newId = 'sv_custom_' + Date.now();
      nodes.push({
        id: newId,
        name: `Điểm chụp mới #${nodes.length + 1}`,
        floor: document.getElementById('adm-sv-floor')?.value || 'TRET',
        x: Math.max(20, Math.min(st.worldWidth - 20, mx)),
        y: Math.max(20, Math.min(st.worldHeight - 20, my)),
        img: '',
        is360: false,
        arrows: []
      });
      activeNodeId = newId;
      pickNewNodeMode = false;
      const pickBtn = document.getElementById('btn-adm-sv-pick-map');
      if (pickBtn) {
        pickBtn.className = 'flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold';
        pickBtn.textContent = '＋ Chấm điểm trên Map';
      }
      getMap().saveStorage();
      renderMapPins();
      refreshAdminStreetViewTab();
      notify('📍 Đã tạo điểm Street View mới trên bản đồ 2D!');
    });

    // Chỉnh sửa thông tin điểm đứng trong Tab Admin Street View
    document.getElementById('adm-sv-name')?.addEventListener('input', (e) => {
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (!node) return;
      node.name = e.target.value;
      getMap().saveStorage();
      renderMapPins();
      const titleEl = document.getElementById('sv-viewer-title');
      if (titleEl && activeNodeId === node.id) titleEl.textContent = node.name;
      // Cập nhật dòng chữ trong danh sách mà không làm mất focus ô đang gõ
      const listBtns = document.querySelectorAll('#adm-sv-nodes-list button');
      const idx = ensureNodesInitialized().findIndex(n => n.id === node.id);
      if (idx >= 0 && listBtns[idx]) {
        const sp = listBtns[idx].querySelector('span');
        if (sp) sp.textContent = `${node.img ? '📷' : '○'} ${node.name}`;
      }
    });

    document.getElementById('adm-sv-floor')?.addEventListener('change', (e) => {
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (!node) return;
      node.floor = e.target.value;
      getMap().saveStorage();
      renderMapPins();
      refreshAdminStreetViewTab();
    });

    document.getElementById('adm-sv-img-path')?.addEventListener('change', (e) => {
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (!node) return;
      const val = e.target.value.trim();
      if (val !== '[Ảnh test cục bộ]') {
        node.img = val;
        getMap().saveStorage();
        renderMapPins();
        refreshAdminStreetViewTab();
      }
    });

    // Nút test nhanh ảnh panorama từ máy tính trước khi đẩy lên GitHub
    document.getElementById('adm-sv-local-file')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (!f || !node) return;
      const url = URL.createObjectURL(f);
      node.img = url;
      renderMapPins();
      refreshAdminStreetViewTab();
      openViewer(node.id);
      notify(`Đã nạp ảnh xem thử "${f.name}". Nhớ chép file này vào thư mục panoramas/ trên GitHub nhé!`);
    });

    document.getElementById('btn-adm-sv-open-editor')?.addEventListener('click', () => {
      if (!activeNodeId) return;
      openViewer(activeNodeId);
      placeArrowMode = true;
      updatePlaceArrowButtonUI();
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (node) renderViewerArrows(node);
    });

    document.getElementById('btn-adm-sv-delete-node')?.addEventListener('click', () => {
      const st = getState();
      if (!activeNodeId) return;
      st.streetViewNodes = ensureNodesInitialized().filter(n => n.id !== activeNodeId);
      activeNodeId = st.streetViewNodes[0] ? st.streetViewNodes[0].id : null;
      getMap().saveStorage();
      renderMapPins();
      refreshAdminStreetViewTab();
    });

    // Các nút trong Trình xem Street View Fullscreen
    document.getElementById('btn-close-streetview')?.addEventListener('click', closeViewer);
    document.getElementById('btn-sv-zoom-in')?.addEventListener('click', () => {
      panoZoom = Math.min(2.6, panoZoom * 1.2);
      applyPanoTransform();
    });
    document.getElementById('btn-sv-zoom-out')?.addEventListener('click', () => {
      panoZoom = Math.max(1.0, panoZoom / 1.2);
      applyPanoTransform();
    });
    document.getElementById('btn-sv-toggle-place-arrow')?.addEventListener('click', () => {
      placeArrowMode = !placeArrowMode;
      updatePlaceArrowButtonUI();
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (node) renderViewerArrows(node);
    });

    // Lưu mũi tên vừa chấm lên ảnh Panorama
    document.getElementById('btn-sv-confirm-arrow')?.addEventListener('click', () => {
      if (!pendingArrowPos) return;
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      const targetId = document.getElementById('sv-new-arrow-target').value;
      const icon = document.getElementById('sv-new-arrow-icon').value;
      const customLbl = document.getElementById('sv-new-arrow-label').value.trim();
      const targetNode = ensureNodesInitialized().find(n => n.id === targetId);

      if (!node || !targetNode) return;
      node.arrows = node.arrows || [];
      node.arrows.push({
        id: 'ar_' + Date.now(),
        x: pendingArrowPos.x,
        y: pendingArrowPos.y,
        targetId,
        icon,
        label: customLbl || targetNode.name
      });

      document.getElementById('sv-arrow-creator-box').classList.add('hidden');
      pendingArrowPos = null;
      getMap().saveStorage();
      renderViewerArrows(node);
      refreshAdminStreetViewTab();
      notify(`Đã gắn mũi tên dẫn tới "${targetNode.name}"!`);
    });

    document.getElementById('btn-sv-cancel-arrow')?.addEventListener('click', () => {
      document.getElementById('sv-arrow-creator-box').classList.add('hidden');
      pendingArrowPos = null;
    });

    // Nút chuyển tầng nhanh trong Mini-Map của trình xem
    document.querySelectorAll('.sv-viewer-floor-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fl = btn.dataset.floor;
        const nodes = ensureNodesInitialized();
        const isAdmin = getState().adminRole === 'FA';
        const match = nodes.find(n => n.floor === fl && (isAdmin || (n.img && n.img.trim() !== '')));
        if (match) {
          openViewer(match.id);
        } else {
          notify(`Chưa có ảnh Street View ở ${floorLabel(fl)}.`);
        }
      });
    });

    initViewerGestures();
    renderMapPins();
  }

  function setAdminTabActive(isActive) {
    adminStreetTabActive = !!isActive;
    if (!isActive) {
      pickNewNodeMode = false;
      const pickBtn = document.getElementById('btn-adm-sv-pick-map');
      if (pickBtn) {
        pickBtn.className = 'flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold';
        pickBtn.textContent = '＋ Chấm điểm trên Map';
      }
    }
    renderMapPins();
  }

  window.NQDStreetView = {
    openViewer,
    closeViewer,
    renderMapPins,
    refreshAdminStreetViewTab,
    setAdminTabActive,
    init: initStreetView
  };
})(window);

  </script>
</body>
</html>
