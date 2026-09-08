/**
 * heart.js — รูปทรงหัวใจ 3 มิติ (model space, แกน y ชี้ขึ้น, กว้างประมาณ ±16)
 *
 * เส้นรอบรูปมาจากสมการหัวใจ 2 มิติคลาสสิก
 * เนื้อในใช้การสุ่มแบบ rejection sampling ในรูปหลายเหลี่ยมเดียวกัน
 * แล้วให้ความหนาตามแกน z มากที่สุดตรงกลางและบางลงที่ขอบ -> ได้ก้อนป่องแบบ 3 มิติ
 */
const Heart = (function () {
  const TAU = Math.PI * 2;
  const SEGMENTS = 240;
  const Y_STRETCH = 1.15;   // ยืดแนวตั้งให้สัดส่วนดูเป็นหัวใจมากขึ้น
  const THICKNESS = 5.4;    // ความหนาสูงสุดที่ใจกลาง

  function curve2d(t) {
    return {
      x: 16 * Math.pow(Math.sin(t), 3),
      y: (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * Y_STRETCH
    };
  }

  // สร้างรูปหลายเหลี่ยมของเส้นรอบรูปไว้ล่วงหน้า + หาจุดกึ่งกลาง
  const poly = [];
  let minY = Infinity, maxY = -Infinity, maxX = 0;
  for (let i = 0; i < SEGMENTS; i++) {
    const p = curve2d((i / SEGMENTS) * TAU);
    poly.push(p);
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (Math.abs(p.x) > maxX) maxX = Math.abs(p.x);
  }
  const CY = (minY + maxY) / 2;
  for (const p of poly) p.y -= CY;   // จัดให้จุดกึ่งกลางอยู่ที่ origin
  const HALF_H = (maxY - minY) / 2;

  function inside(x, y) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  }

  /** อัตราส่วนระยะจากใจกลางถึงขอบตามทิศของจุดนั้น (0 = ใจกลาง, 1 = ขอบ) */
  function edgeRatio(x, y) {
    let lo = 1, hi = 4;
    // หาตัวคูณที่ทำให้จุดนี้ไปแตะขอบพอดี
    while (hi - lo > 0.02) {
      const mid = (lo + hi) / 2;
      if (inside(x * mid, y * mid)) lo = mid; else hi = mid;
    }
    return 1 / lo;
  }

  function thicknessAt(ratio) {
    return THICKNESS * Math.sqrt(Math.max(0, 1 - ratio * ratio));
  }

  /** สุ่มจุดบนเส้นรอบรูป */
  function edgePoint() {
    const p = poly[(Math.random() * poly.length) | 0];
    const jitter = 0.5;
    return {
      x: p.x + (Math.random() - 0.5) * jitter,
      y: p.y + (Math.random() - 0.5) * jitter,
      z: (Math.random() - 0.5) * 1.2,
      shell: 1
    };
  }

  /** สุ่มจุดหนึ่งจุดในปริมาตรหัวใจ */
  function samplePoint() {
    // 34% เกาะขอบ ให้เส้นรอบรูปคม
    if (Math.random() < 0.34) return edgePoint();

    let x = 0, y = 0;
    for (let i = 0; i < 40; i++) {
      x = (Math.random() * 2 - 1) * maxX;
      y = (Math.random() * 2 - 1) * HALF_H;
      if (inside(x, y)) break;
      if (i === 39) return edgePoint();
    }

    const ratio = edgeRatio(x, y);
    const t = thicknessAt(ratio);

    // ครึ่งหนึ่งเกาะผิวหน้า/หลัง อีกครึ่งกระจายในเนื้อ -> เห็นความหนาชัดตอนหมุน
    const z = Math.random() < 0.55
      ? (Math.random() < 0.5 ? -1 : 1) * t * (0.85 + Math.random() * 0.15)
      : (Math.random() * 2 - 1) * t;

    return { x: x, y: y, z: z, shell: ratio };
  }

  return { samplePoint, edgePoint, curve2d, inside, THICKNESS, HALF_H, HALF_W: maxX };
})();
