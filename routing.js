/**
 * ============================================================================
 * PHẦN 3: MODULE CHỈ ĐƯỜNG NGẮN NHẤT & ĐỊNH VỊ QR 20M (routing.js)
 * Dự án KHKT: Bản đồ số tương tác & Điều hướng sự kiện THPT Chuyên Nguyễn Quang Diêu
 * - Thuật toán A* (Orthogonal Grid A*) tìm đường ngắn nhất dọc hành lang & sân trường
 * - Khóa cứng vùng cấm cắt ngang Khu vực Sân Chào Cờ (trừ khi điểm đầu/cuối là Cột cờ)
 * - Tự động so sánh tất cả cầu thang khi đi khác tầng để chọn cầu thang ngắn nhất
 * - Hỗ trợ đi xuyên vào gian hàng nội thất khi bật chế độ Public
 * - Hỗ trợ Line Cố Định Đặc Biệt của Sự kiện (BTC)
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

  const GRID_STEP = 14;
  let targetSubBoothId = null;

  function getMap() {
    return window.NQDMap;
  }

  function getState() {
    return window.NQDMap ? window.NQDMap.state : null;
  }

  // 1. TỌA ĐỘ CỬA RA VÀO HÀNH LANG CỦA MỖI PHÒNG
  function getRoomAccessPoint(room, subId) {
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

    // Dãy Học Trái mở cửa sang Hành lang Tây (x ~ 538)
    if (room.x + room.w <= 525 && room.y >= 710 && room.y <= 1230) return { x: 538, y: cy };
    // Dãy Thực Hành Phải mở cửa sang Hành lang Đông (x ~ 1180)
    if (room.x >= 1195 && room.x <= 1400 && room.y >= 770 && room.y <= 1285) return { x: 1180, y: cy };
    // Khu Hành chính mở cửa lên Hành lang Nam (y ~ 1260)
    if (room.y >= 1275 && room.y <= 1415 && room.x >= 500 && room.x <= 1210) return { x: cx, y: 1260 };
    // Dãy Chính Giữa mở cửa xuống Hành lang Chính Giữa (y ~ 698)
    if (room.y >= 485 && room.y <= 680 && room.x >= 550 && room.x <= 1170) return { x: cx, y: 698 };
    // Khu KTX Bắc mở cửa xuống Hành lang Bắc (x ~ 860, y ~ 380)
    if (room.y <= 365 && room.x >= 800 && room.x <= 1210) return { x: 860, y: 378 };

    return { x: cx, y: cy };
  }

  // 2. XÂY DỰNG LƯỚI VẬT CẢN (KHÔNG XUYÊN TƯỜNG + NÉ KHU VỰC SÂN CHÀO CỜ)
  function buildWalkableGrid(sheet, startId, endId) {
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

    // VÙNG CẤM: Khu vực Sân Chào Cờ (TRỪ KHI điểm đi hoặc đến là Cột cờ)
    if (startId !== 'cot_co' && endId !== 'cot_co') {
      markRect(780, 752, 160, 235, 2);
    }

    // Đánh dấu vật cản là toàn bộ các khối phòng, cây xanh, công trình (trừ điểm đầu/cuối & cầu thang)
    sheet.rooms.forEach(r => {
      if (r.id === startId || r.id === endId || r.isStair) return;
      markRect(r.x + 3, r.y + 3, Math.max(4, r.w - 6), Math.max(4, r.h - 6), 0);
    });

    return { blocked, cols, rows };
  }

  function findNearestFreeCell(grid, px, py) {
    const { blocked, cols, rows } = grid;
    const sc = Math.max(0, Math.min(cols - 1, Math.round(px / GRID_STEP)));
    const sr = Math.max(0, Math.min(rows - 1, Math.round(py / GRID_STEP)));
    if (!blocked[sr * cols + sc]) return { c: sc, r: sr };

    for (let rad = 1; rad <= 28; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
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

  // 3. THUẬT TOÁN A* TÌM ĐƯỜNG NGẮN NHẤT VUÔNG GÓC (HÀNH LANG + SÂN TRƯỜNG)
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

        let cost = 1.0;
        if (prev >= 0 && (nc - uc !== uc - pc || nr - ur !== ur - pr)) {
          cost += 0.15; // Giữ đường thẳng mượt, hạn chế zíc zắc
        }

        // Ưu tiên nhẹ trục hành lang để nét vẽ đi gọn giữa hành lang
        const wx = nc * GRID_STEP;
        const wy = nr * GRID_STEP;
        const inCorridor =
          (wx >= 518 && wx <= 560 && wy >= 492 && wy <= 1282) ||
          (wx >= 1160 && wx <= 1202 && wy >= 360 && wy <= 1282) ||
          (wy >= 1240 && wy <= 1282 && wx >= 518 && wx <= 1202) ||
          (wy >= 678 && wy <= 720 && wx >= 518 && wx <= 1202) ||
          (wx >= 816 && wx <= 904 && wy >= 360 && wy <= 492);
        if (inCorridor) cost *= 0.90;

        const nextG = gScore[u] + cost;
        if (nextG < gScore[v]) {
          cameFrom[v] = u;
          gScore[v] = nextG;
          push(v, nextG + Math.abs(nc - e.c) + Math.abs(nr - e.r));
        }
      }
    }

    const pts = [{ x: ptB.x, y: ptB.y }];
    let c = endIdx;
    if (cameFrom[c] !== -1 || c === startIdx) {
      while (c !== -1) {
        const r = Math.floor(c / cols);
        const col = c % cols;
        pts.push({ x: col * GRID_STEP, y: r * GRID_STEP });
        c = cameFrom[c];
      }
    }
    pts.push({ x: ptA.x, y: ptA.y });
    pts.reverse();

    // Rút gọn các điểm thẳng hàng
    const clean = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = clean[clean.length - 1];
      const b = pts[i];
      const d1 = Math.abs(a.x - b.x) < 1 && Math.abs(b.x - pts[i + 1].x) < 1;
      const d2 = Math.abs(a.y - b.y) < 1 && Math.abs(b.y - pts[i + 1].y) < 1;
      if (!d1 && !d2) clean.push(b);
    }
    clean.push(pts[pts.length - 1]);
    return { points: clean, cost: gScore[endIdx] };
  }

  function normalizeFloor(fl) {
    if (!fl || fl === 'HANHCHINH' || fl === 'NGOAIVI' || fl === 'ALL') return 'TRET';
    return fl;
  }

  function computeShortestRoute(sheet, roomA, roomB, subId) {
    const grid = buildWalkableGrid(sheet, roomA.id, roomB.id);
    const centerA = { x: roomA.x + roomA.w / 2, y: roomA.y + roomA.h / 2 };
    const doorA = getRoomAccessPoint(roomA, null);
    const doorB = getRoomAccessPoint(roomB, subId);
    const centerB = subId ? doorB : { x: roomB.x + roomB.w / 2, y: roomB.y + roomB.h / 2 };

    const flA = normalizeFloor(roomA.floor);
    const flB = normalizeFloor(roomB.floor);

    if (flA === flB) {
      const res = aStarShortestPath(grid, doorA, doorB);
      return {
        points: [centerA, ...res.points, centerB],
        stair: null,
        stairBadge: null,
        meters: Math.max(5, Math.round(res.cost * 0.72))
      };
    }

    // Khác tầng: Duyệt toàn bộ cầu thang để chọn cầu thang có tổng quãng đường ngắn nhất
    const stairs = sheet.rooms.filter(r => r.isStair);
    let bestCost = Infinity;
    let bestStair = null;
    let bestPts = [];

    stairs.forEach(st => {
      const stCenter = { x: st.x + st.w / 2, y: st.y + st.h / 2 };
      const leg1 = aStarShortestPath(grid, doorA, stCenter);
      const leg2 = aStarShortestPath(grid, stCenter, doorB);
      const total = leg1.cost + leg2.cost;
      if (total < bestCost) {
        bestCost = total;
        bestStair = st;
        bestPts = [centerA, ...leg1.points, stCenter, ...leg2.points, centerB];
      }
    });

    const rank = { TRET: 0, LAU1: 1, LAU2: 2 };
    const up = (rank[flB] || 0) > (rank[flA] || 0);
    const flName = { TRET: 'Trệt', LAU1: 'Lầu 1', LAU2: 'Lầu 2' };
    const stairBadge = up ? `⬆️ Lên ${flName[flB] || flB}` : `⬇️ Xuống ${flName[flB] || flB}`;

    return {
      points: bestPts,
      stair: bestStair,
      stairBadge,
      meters: Math.max(8, Math.round(bestCost * 0.72))
    };
  }

  // 4. VẼ ĐƯỜNG CHỈ DẪN LÊN LỚP TRÊN CÙNG (TOP LAYER) & NHÃN CHUYỂN TẦNG
  function renderRoutingLayer() {
    const st = getState();
    const svg = document.getElementById('wayfinding-svg');
    const badges = document.getElementById('wayfinding-badges-layer');
    const banner = document.getElementById('active-route-banner');
    if (!st || !svg || !badges) return;

    svg.innerHTML = '';
    badges.innerHTML = '';
    const sheet = getMap().getActiveSheet();

    // A. Vẽ các Line Cố Định Đặc Biệt của Sự kiện (D2)
    (sheet.fixedLines || []).forEach(fl => {
      const r1 = sheet.rooms.find(r => r.id === fl.from);
      const r2 = sheet.rooms.find(r => r.id === fl.to);
      if (!r1 || !r2) return;
      const rt = computeShortestRoute(sheet, r1, r2, null);
      const d = rt.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      const casing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      casing.setAttribute('d', d);
      casing.setAttribute('class', 'fixed-event-line-casing');
      svg.appendChild(casing);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', d);
      line.setAttribute('stroke', fl.color || '#10b981');
      line.setAttribute('class', 'fixed-event-line-main');
      svg.appendChild(line);
    });

    // B. Vẽ Line Chỉ Đường A -> B
    if (!st.pointA || !st.pointB) {
      st.activeStairId = null;
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

    const effSub = roomB.interiorPublic ? targetSubBoothId : null;
    const route = computeShortestRoute(sheet, roomA, roomB, effSub);

    // Tự động bật sáng 100% Điểm A, Cầu thang và Điểm B kể cả khi đang lọc tầng khác (IV.3)
    const prevStair = st.activeStairId;
    st.activeStairId = route.stair ? route.stair.id : null;
    if (prevStair !== st.activeStairId) {
      getMap().renderRooms();
    }

    const d = route.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const casing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    casing.setAttribute('d', d);
    casing.setAttribute('class', 'route-line-casing');
    svg.appendChild(casing);

    const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mainLine.setAttribute('d', d);
    mainLine.setAttribute('class', 'route-line-main');
    svg.appendChild(mainLine);

    const p0 = route.points[0];
    const pN = route.points[route.points.length - 1];
    addPin(badges, p0.x, p0.y, `📍 A: ${roomA.name}`, 'bg-emerald-600 text-white');
    addPin(badges, pN.x, pN.y, `🚩 B: ${roomB.name}`, 'bg-rose-600 text-white');

    if (route.stair && route.stairBadge) {
      addPin(
        badges,
        route.stair.x + route.stair.w / 2,
        route.stair.y + route.stair.h / 2,
        route.stairBadge,
        'bg-amber-400 text-slate-950 border-2 border-slate-950 animate-bounce'
      );
    }

    if (banner) {
      banner.classList.remove('hidden');
      banner.classList.add('flex');
      document.getElementById('route-banner-endpoints').textContent =
        `${roomA.name} ➔ ${roomB.name} (~${route.meters}m)`;
      document.getElementById('route-banner-sub').textContent = route.stairBadge
        ? `Qua ${route.stair.name} (${route.stairBadge})`
        : 'Đường ngắn nhất dọc hành lang & sân trường (Né Sân Chào Cờ)';
    }
  }

  function addPin(container, x, y, text, cls) {
    const el = document.createElement('div');
    el.style.left = x + 'px';
    el.style.top = (y - 16) + 'px';
    el.className = `absolute -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xl whitespace-nowrap ${cls}`;
    el.textContent = text;
    container.appendChild(el);
  }

  // 5. HỆ THỐNG 12 TRẠM MÃ QR 20M (?from=qr_tram_...) & "TÔI ĐANG Ở ĐÂU?"
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
      targetSubBoothId = null;
      getMap().render();
    });

    // Hỗ trợ bấm trực tiếp vào quầy nội thất Public để dẫn đường vào trong (D4)
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
