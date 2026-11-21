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
