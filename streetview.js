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
  const localPreviewUrls = {}; // Bộ nhớ tạm chỉ để xem trước file chọn từ máy, KHÔNG ghi đè đường dẫn lưu
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

    const previewSrc = localPreviewUrls[node.id] || (node.img ? node.img.trim() : '');
    const hasImg = !!(previewSrc && previewSrc !== '');
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
        notify('Không tải được ảnh: ' + (node.img || previewSrc));
      };
      imgEl.src = previewSrc;
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

    function applyImgPathInput(val, shouldRefreshList) {
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (!node) return;
      const clean = (val || '').trim();
      if (clean !== '[Ảnh test cục bộ]') {
        node.img = clean;
        delete localPreviewUrls[node.id];
        getMap().saveStorage();
        renderMapPins();
        if (shouldRefreshList) {
          refreshAdminStreetViewTab();
        } else {
          const nodes = ensureNodesInitialized();
          const idx = nodes.findIndex(n => n.id === node.id);
          const listBtns = document.querySelectorAll('#adm-sv-nodes-list button');
          if (idx >= 0 && listBtns[idx]) {
            const sp = listBtns[idx].querySelector('span');
            if (sp) sp.textContent = `${node.img ? '📷' : '○'} ${node.name}`;
          }
          const countEl = document.getElementById('adm-sv-stats');
          if (countEl) {
            const withPhoto = nodes.filter(n => n.img && n.img.trim() !== '').length;
            countEl.textContent = `${withPhoto}/${nodes.length} điểm đã có ảnh`;
          }
        }
      }
    }

    document.getElementById('adm-sv-img-path')?.addEventListener('input', (e) => {
      applyImgPathInput(e.target.value, false);
    });
    document.getElementById('adm-sv-img-path')?.addEventListener('change', (e) => {
      applyImgPathInput(e.target.value, true);
    });

    // Nút chọn ảnh từ máy: TỰ ĐỘNG lưu đường dẫn chuẩn panoramas/<tên_file> để đồng bộ Cloud + xem trước ngay
    document.getElementById('adm-sv-local-file')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      const node = ensureNodesInitialized().find(n => n.id === activeNodeId);
      if (!f || !node) return;
      const url = URL.createObjectURL(f);
      localPreviewUrls[node.id] = url;
      node.img = 'panoramas/' + f.name;
      const pathEl = document.getElementById('adm-sv-img-path');
      if (pathEl) pathEl.value = node.img;
      getMap().saveStorage();
      renderMapPins();
      refreshAdminStreetViewTab();
      openViewer(node.id);
      e.target.value = '';
      notify(`✅ Đã gắn "${node.img}" & lưu máy! Nhớ bấm ☁️ Lưu để đẩy lên Cloud.`);
    });

    document.getElementById('btn-adm-sv-save-cloud')?.addEventListener('click', () => {
      flushActiveEdits();
      if (window.NQDAdmin && typeof window.NQDAdmin.pushToFirebaseCloud === 'function') {
        window.NQDAdmin.pushToFirebaseCloud();
      } else {
        getMap().saveStorage();
        notify('✅ Đã lưu Street View trên máy!');
      }
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

  function flushActiveEdits() {
    const nodes = ensureNodesInitialized();
    const node = nodes.find(n => n.id === activeNodeId);
    if (!node) return;
    const nameEl = document.getElementById('adm-sv-name');
    const floorEl = document.getElementById('adm-sv-floor');
    const imgEl = document.getElementById('adm-sv-img-path');
    if (nameEl && nameEl.value.trim()) node.name = nameEl.value.trim();
    if (floorEl && floorEl.value) node.floor = floorEl.value;
    if (imgEl) {
      const v = imgEl.value.trim();
      if (v && v !== '[Ảnh test cục bộ]' && !v.startsWith('blob:')) {
        node.img = v;
      }
    }
    getMap().saveStorage();
  }

  window.NQDStreetView = {
    openViewer,
    closeViewer,
    renderMapPins,
    refreshAdminStreetViewTab,
    setAdminTabActive,
    flushActiveEdits,
    init: initStreetView
  };
})(window);
