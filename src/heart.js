/**
 * heart.js — โครงหัวใจ 3 มิติ ที่ "อยู่กับที่" แต่ให้อนุภาคไหลวนอยู่ข้างใน
 *
 * แนวคิด: ตัดหัวใจเป็นแถบตามความสูง (bands) แต่ละแถบได้ช่วง x ที่อยู่ในรูป (spans)
 * อนุภาคในเนื้อจะโคจรเป็นวงรีอยู่ใน span ของตัวเอง (x = c + f*a*cosθ, z = f*a*K*sinθ)
 * ทำให้เงาหัวใจเมื่อมองจากด้านหน้าคงรูปเดิมเสมอ ส่วนละอองข้างในหมุนวนได้
 * อนุภาคขอบจะวิ่งไหลไปตามเส้นรอบรูปแทน เพื่อให้เส้นขอบคมและมีการเคลื่อนไหว
 */
const Heart = (function () {
  const TAU = Math.PI * 2;
  const SEGMENTS = 360;
  const Y_STRETCH = 1.15;   // ยืดแนวตั้งให้สัดส่วนดูเป็นหัวใจ
  const BANDS = 96;         // จำนวนแถบตามความสูง
  const K = 0.62;           // อัตราส่วนความหนา (z) ต่อความกว้างของ span

  function raw(t) {
    return {
      x: 16 * Math.pow(Math.sin(t), 3),
      y: (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * Y_STRETCH
    };
  }

  // เส้นรอบรูป + จัดให้จุดกึ่งกลางอยู่ที่ origin
  let minY = Infinity, maxY = -Infinity, maxX = 0;
  const poly = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const p = raw((i / SEGMENTS) * TAU);
    poly.push(p);
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (Math.abs(p.x) > maxX) maxX = Math.abs(p.x);
  }
  const CY = (minY + maxY) / 2;
  for (const p of poly) p.y -= CY;
  const HALF_H = (maxY - minY) / 2;

  /** จุดบนเส้นรอบรูปที่พารามิเตอร์ t (0..1 วนรอบ) */
  function curvePoint(t) {
    const p = raw(((t % 1) + 1) % 1 * TAU);
    return { x: p.x, y: p.y - CY };
  }

  /* ---------- ตัดหัวใจเป็นแถบ ---------- */
  const bands = [];
  for (let i = 0; i < BANDS; i++) {
    const y = -HALF_H + ((i + 0.5) / BANDS) * HALF_H * 2;
    const xs = [];
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      const a = poly[j], b = poly[k];
      if ((a.y > y) !== (b.y > y)) {
        xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
      }
    }
    xs.sort((p, q) => p - q);
    const spans = [];
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const a = (xs[j + 1] - xs[j]) / 2;
      if (a > 0.35) spans.push({ c: (xs[j] + xs[j + 1]) / 2, a: a });
    }
    if (spans.length) {
      bands.push({ y: y, h: (HALF_H * 2) / BANDS, spans: spans });
    }
  }

  // ตารางน้ำหนักตามพื้นที่ ใช้สุ่มให้ความหนาแน่นสม่ำเสมอทั้งรูป
  let totalArea = 0;
  const cumulative = [];
  for (const b of bands) {
    for (const s of b.spans) {
      totalArea += s.a * 2 * b.h;
      cumulative.push({ band: b, span: s, upto: totalArea });
    }
  }

  function pickCell() {
    const r = Math.random() * totalArea;
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid].upto < r) lo = mid + 1; else hi = mid;
    }
    return cumulative[lo];
  }

  /**
   * ที่นั่งประจำตัวของอนุภาค
   * edge = ไหลไปตามเส้นรอบรูป, body = โคจรเป็นวงรีอยู่ในเนื้อ
   */
  function randomSeat(edgeChance) {
    if (Math.random() < (edgeChance === undefined ? 0.28 : edgeChance)) {
      return {
        type: 'edge',
        t: Math.random(),
        zj: (Math.random() - 0.5) * 1.6,
        nj: (Math.random() - 0.5) * 0.7
      };
    }
    const cell = pickCell();
    return {
      type: 'body',
      band: cell.band,
      span: cell.span,
      f: Math.sqrt(Math.random()),
      th: Math.random() * TAU,
      yj: (Math.random() - 0.5) * cell.band.h
    };
  }

  function seatPosition(seat) {
    if (seat.type === 'edge') {
      const p = curvePoint(seat.t);
      const n = 1 + seat.nj * 0.02;
      return { x: p.x * n, y: p.y * n, z: seat.zj };
    }
    const a = seat.span.a * seat.f;
    return {
      x: seat.span.c + a * Math.cos(seat.th),
      y: seat.band.y + seat.yj,
      z: a * K * Math.sin(seat.th)
    };
  }

  /** ขยับที่นั่งไปตามเวลา -> ละอองไหลวนโดยรูปหัวใจไม่ขยับ */
  function advanceSeat(seat, dt, speed) {
    if (seat.type === 'edge') {
      seat.t += dt * speed * 0.055;
    } else {
      // ข้างในหมุนไวกว่าขอบเล็กน้อย ได้ความรู้สึกเป็นกระแสวน
      seat.th += dt * speed * (1.35 - seat.f * 0.55);
    }
  }

  return {
    randomSeat, seatPosition, advanceSeat, curvePoint,
    HALF_H: HALF_H, HALF_W: maxX, BANDS: bands.length
  };
})();
