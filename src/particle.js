/**
 * particle.js — อนุภาคหนึ่งตัว
 *
 * ตำแหน่งประจำตัว (home) ไม่ได้อยู่นิ่ง แต่ไหลวนตามที่นั่งใน Heart
 * ตัวอนุภาคใช้สปริงวิ่งตาม home -> ได้ทั้งการไหลวนและการระเบิด/รวมร่างในระบบเดียว
 */
const PALETTE = [
  '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#dbeafe', '#a5f3fc'
];

/**
 * แคชสไปรต์แสงของแต่ละสี วาดครั้งเดียวแล้ว drawImage ซ้ำ
 * เร็วกว่าการวาด arc + gradient รายอนุภาคทุกเฟรมมาก
 */
const Sprites = (function () {
  const cache = new Map();

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function make(size, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const s of stops) grad.addColorStop(s[0], s[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /** จุดแสงแกนกลางสว่าง */
  function get(color) {
    let c = cache.get(color);
    if (c) return c;
    c = make(48, [
      [0.00, '#ffffff'],
      [0.18, color],
      [0.45, hexToRgba(color, 0.35)],
      [1.00, hexToRgba(color, 0)]
    ]);
    cache.set(color, c);
    return c;
  }

  /** ก้อนหมอกนุ่ม ๆ ไม่มีแกนสว่าง */
  function soft(color) {
    const key = 'soft:' + color;
    let c = cache.get(key);
    if (c) return c;
    c = make(128, [
      [0.00, hexToRgba(color, 0.5)],
      [0.35, hexToRgba(color, 0.2)],
      [0.70, hexToRgba(color, 0.055)],
      [1.00, hexToRgba(color, 0)]
    ]);
    cache.set(key, c);
    return c;
  }

  return { get, soft };
})();

class Particle {
  constructor() {
    this.color = PALETTE[(Math.random() * PALETTE.length) | 0];
    this.sprite = Sprites.get(this.color);
    this.phase = Math.random() * Math.PI * 2;
    this.seat = Heart.randomSeat();

    if (this.seat.type === 'edge') {
      this.size = 0.45 + Math.random() * 0.85;
      this.bright = 1;
    } else {
      this.size = 0.5 + Math.random() * 1.25;
      this.bright = 0.5 + Math.random() * 0.4;
    }

    this.syncHome();
    this.spawnAtPool();
    this.px = null;   // ตำแหน่งบนจอเฟรมก่อนหน้า ใช้ลากเส้นหาง
    this.py = null;
  }

  syncHome() {
    const h = Heart.seatPosition(this.seat);
    this.hx = h.x;
    this.hy = h.y;
    this.hz = h.z;
  }

  /** ให้ที่นั่งไหลวนไปตามเวลา (รูปหัวใจไม่ขยับ แต่ละอองหมุน) */
  swirl(dt, speed) {
    Heart.advanceSeat(this.seat, dt, speed);
    this.syncHome();
  }

  /** เกิดใหม่จากแอ่งแสงด้านล่าง */
  spawnAtPool() {
    this.x = (Math.random() - 0.5) * 7;
    this.y = -24 + (Math.random() - 0.5) * 3;
    this.z = (Math.random() - 0.5) * 7;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = 6 + Math.random() * 14;
    this.vz = (Math.random() - 0.5) * 4;
    this.px = this.py = null;
  }

  /** ผลักออกจากใจกลางแบบระเบิด */
  explode(power) {
    const len = Math.hypot(this.x, this.y, this.z) || 1;
    const spread = 0.55;
    this.vx += (this.x / len) * power * (0.7 + Math.random() * 0.6) + (Math.random() - 0.5) * power * spread;
    this.vy += (this.y / len) * power * (0.7 + Math.random() * 0.6) + (Math.random() - 0.5) * power * spread;
    this.vz += (this.z / len) * power * (0.7 + Math.random() * 0.6) + (Math.random() - 0.5) * power * spread;
  }

  /**
   * @param {number} dt  วินาที
   * @param {object} cfg { spring, damping, noise }
   */
  update(dt, cfg, time) {
    this.vx += (this.hx - this.x) * cfg.spring * dt;
    this.vy += (this.hy - this.y) * cfg.spring * dt;
    this.vz += (this.hz - this.z) * cfg.spring * dt;

    const damp = Math.pow(cfg.damping, dt * 60);
    this.vx *= damp;
    this.vy *= damp;
    this.vz *= damp;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // สั่นระยิบ ๆ ตอนอยู่ในรูป
    if (cfg.noise) {
      this.x += Math.sin(time * 1.7 + this.phase) * cfg.noise * dt;
      this.y += Math.cos(time * 2.1 + this.phase) * cfg.noise * dt;
      this.z += Math.sin(time * 1.3 + this.phase * 1.7) * cfg.noise * dt;
    }
  }

  /** ระยะห่างจากตำแหน่งประจำตัว ใช้คุมความสว่างตอนกำลังบินเข้ารูป */
  distanceHome() {
    return Math.hypot(this.hx - this.x, this.hy - this.y, this.hz - this.z);
  }
}
