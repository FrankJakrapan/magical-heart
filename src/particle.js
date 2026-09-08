/**
 * particle.js — อนุภาคหนึ่งตัวใน model space
 *
 * ทุกอย่างคิดใน model space (ไม่หมุน) แล้วค่อยหมุน + ฉายเป็น 2 มิติตอนวาด
 * ทำให้จังหวะ "แตกตัว -> รวมกลับ" ทำงานร่วมกับการหมุนได้โดยไม่พัง
 */
const PALETTE = [
  '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#dbeafe', '#a5f3fc'
];

/**
 * แคชสไปรต์แสงฟุ้งของแต่ละสี วาดครั้งเดียวแล้ว drawImage ซ้ำ
 * เร็วกว่าการวาด arc + gradient รายอนุภาคทุกเฟรมมาก
 */
const Sprites = (function () {
  const SIZE = 48;
  const cache = new Map();

  function get(color) {
    let c = cache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0.00, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, hexToRgba(color, 0.35));
    grad.addColorStop(1.00, hexToRgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    cache.set(color, c);
    return c;
  }

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  return { get };
})();

class Particle {
  constructor() {
    this.color = PALETTE[(Math.random() * PALETTE.length) | 0];
    this.sprite = Sprites.get(this.color);
    this.size = 0.5 + Math.random() * 1.3;
    this.phase = Math.random() * Math.PI * 2;
    this.assignHome();
    this.spawnAtPool();
    this.px = null; // ตำแหน่งจอครั้งก่อน ใช้ลากเส้นหาง
    this.py = null;
  }

  /** จับจองตำแหน่งประจำตัวในทรงหัวใจ */
  assignHome() {
    const h = Heart.samplePoint();
    this.hx = h.x;
    this.hy = h.y;
    this.hz = h.z;
    this.shell = h.shell;
    // อนุภาคขอบสว่างกว่าและเล็กกว่า -> ได้เส้นรอบรูปคม
    if (this.shell > 0.93) {
      this.size = 0.4 + Math.random() * 0.9;
      this.bright = 1;
    } else {
      this.bright = 0.55 + Math.random() * 0.35;
    }
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
   * @param {object} cfg { spring, damping, noise, gravity }
   */
  update(dt, cfg, time) {
    // สปริงดึงกลับเข้าตำแหน่งประจำตัว
    this.vx += (this.hx - this.x) * cfg.spring * dt;
    this.vy += (this.hy - this.y) * cfg.spring * dt;
    this.vz += (this.hz - this.z) * cfg.spring * dt;

    if (cfg.gravity) this.vy -= cfg.gravity * dt;

    const damp = Math.pow(cfg.damping, dt * 60);
    this.vx *= damp;
    this.vy *= damp;
    this.vz *= damp;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // สั่นระยิบ ๆ ตอนอยู่นิ่ง
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
