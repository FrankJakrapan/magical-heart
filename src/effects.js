/**
 * effects.js — ฉากหลัง แอ่งแสง ลำแสง และเส้นแสงที่วิ่งวนรอบหัวใจ
 */
const Effects = (function () {

  /* ---------- ดาวพื้นหลัง ---------- */
  function createStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.5 + 0.1,
        tw: Math.random() * Math.PI * 2
      });
    }
    return stars;
  }

  function drawStars(ctx, stars, W, H, time) {
    for (const s of stars) {
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(time * 1.2 + s.tw));
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- แอ่งแสงใต้หัวใจ + ลำแสง ---------- */
  function drawPool(ctx, view, time, energy) {
    const base = view.project(0, -24, 0);
    const rx = view.scale * 13 * base.p * (1 + energy * 0.25);
    const ry = rx * 0.28;
    const pulse = 1 + Math.sin(time * 1.8) * 0.05 + energy * 0.15;

    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.scale(rx * pulse, ry * pulse);
    const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
    g.addColorStop(0.00, 'rgba(226,247,255,0.95)');
    g.addColorStop(0.32, 'rgba(96,165,250,0.72)');
    g.addColorStop(0.68, 'rgba(37,99,235,0.32)');
    g.addColorStop(1.00, 'rgba(29,78,216,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ลำแสงพุ่งขึ้นหาหัวใจ
    const top = view.project(0, -11, 0);
    const bg = ctx.createLinearGradient(0, base.y, 0, top.y);
    bg.addColorStop(0, 'rgba(96,165,250,' + (0.26 + energy * 0.2) + ')');
    bg.addColorStop(1, 'rgba(96,165,250,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(base.x - rx * 0.5, base.y);
    ctx.lineTo(base.x + rx * 0.5, base.y);
    ctx.lineTo(top.x + rx * 0.16, top.y);
    ctx.lineTo(top.x - rx * 0.16, top.y);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- เส้นแสงวิ่งวนรอบหัวใจ ---------- */
  class OrbitSpark {
    constructor(ring) {
      this.ring = ring;                        // 0..2 คนละระนาบ
      this.a = Math.random() * Math.PI * 2;
      this.r = 19 + ring * 4 + Math.random() * 3;
      this.speed = (0.5 + Math.random() * 0.5) * (ring % 2 ? -1 : 1);
      this.tilt = (ring - 1) * 0.45;
      this.yoff = (Math.random() - 0.5) * 16;
      this.size = 0.6 + Math.random() * 1.1;
      this.color = ring === 1 ? '#a5f3fc' : '#93c5fd';
      this.px = this.py = null;
    }

    update(dt, energy) {
      this.a += this.speed * dt * (1 + energy * 1.6);
      this.radius = this.r * (1 + energy * 0.8);
    }

    position() {
      const r = this.radius || this.r;
      const x = Math.cos(this.a) * r;
      const z = Math.sin(this.a) * r;
      // เอียงระนาบวงโคจรรอบแกน x
      const y = this.yoff + z * Math.sin(this.tilt);
      return { x: x, y: y, z: z * Math.cos(this.tilt) };
    }
  }

  function createSparks(count) {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(new OrbitSpark(i % 3));
    return arr;
  }

  return { createStars, drawStars, drawPool, createSparks };
})();
