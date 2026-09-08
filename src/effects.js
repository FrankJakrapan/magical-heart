/**
 * effects.js — ฉากหลัง แอ่งแสง หมอกที่พุ่งออกจากแอ่ง วงคลื่น และเส้นแสงวิ่งวน
 */
const Effects = (function () {

  const POOL_Y = -24;          // ระดับแอ่งแสงใน model space
  const MIST_COLORS = ['#60a5fa', '#93c5fd', '#bfdbfe', '#3b82f6'];

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
    ctx.fillStyle = '#cfe6ff';
    for (const s of stars) {
      ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(time * 1.2 + s.tw));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- แอ่งแสงใต้หัวใจ + ลำแสง ---------- */
  function drawPool(ctx, view, time, energy) {
    const base = view.project(0, POOL_Y, 0);
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

  /* ---------- หมอกที่พวยพุ่งออกจากแอ่ง ---------- */
  class MistPuff {
    constructor() {
      this.color = MIST_COLORS[(Math.random() * MIST_COLORS.length) | 0];
      this.sprite = Sprites.soft(this.color);
      this.reset(true, 0);
    }

    reset(initial, energy) {
      // 35% เป็นหมอกนอนพื้น ที่เหลือเป็นไอที่พวยพุ่งออกด้านข้าง
      this.bed = Math.random() < 0.35;

      const ang = Math.random() * Math.PI * 2;
      const r0 = Math.random() * (this.bed ? 18 : 6);
      this.x = Math.cos(ang) * r0;
      this.z = Math.sin(ang) * r0;
      this.y = POOL_Y + Math.random() * (this.bed ? 1.5 : 3);

      const push = (this.bed ? 2 + Math.random() * 4 : 8 + Math.random() * 16) * (1 + energy * 1.8);
      this.vx = Math.cos(ang) * push;
      this.vz = Math.sin(ang) * push;
      this.vy = this.bed
        ? 0.2 + Math.random() * 0.8
        : 1.2 + Math.random() * 3.4 + energy * 5;

      this.size = this.bed ? 10 + Math.random() * 10 : 3 + Math.random() * 5;
      this.grow = this.bed ? 2 + Math.random() * 3 : 4 + Math.random() * 6;
      this.maxLife = this.bed ? 4.5 + Math.random() * 3 : 2.8 + Math.random() * 2.4;
      this.life = initial ? Math.random() * this.maxLife : 0;
      this.spin = (Math.random() - 0.5) * 0.9;
      this.peak = this.bed ? 0.06 + Math.random() * 0.06 : 0.08 + Math.random() * 0.08;
    }

    update(dt, energy) {
      this.life += dt;
      if (this.life > this.maxLife) { this.reset(false, energy); return; }

      // ม้วนตัวเล็กน้อยระหว่างลอย
      const c = Math.cos(this.spin * dt), s = Math.sin(this.spin * dt);
      const vx = this.vx * c - this.vz * s;
      this.vz = this.vx * s + this.vz * c;
      this.vx = vx;

      const drag = Math.pow(0.972, dt * 60);
      this.vx *= drag;
      this.vz *= drag;
      this.vy = this.vy * Math.pow(0.985, dt * 60) + 1.6 * dt;

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.z += this.vz * dt;
      this.size += this.grow * dt;
    }

    alpha() {
      const t = this.life / this.maxLife;
      const inFade = Math.min(1, t / 0.18);
      const outFade = Math.min(1, (1 - t) / 0.55);
      // จางลงเมื่อลอยสูงขึ้น ไม่ให้บังหัวใจ
      const height = Math.max(0, 1 - (this.y - POOL_Y) / (this.bed ? 10 : 16));
      return this.peak * inFade * outFade * height;
    }
  }

  function createMist(count) {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(new MistPuff());
    return arr;
  }

  function drawMist(ctx, view, mist, dt, energy) {
    for (const m of mist) {
      m.update(dt, energy);
      const s = view.project(m.x, m.y, m.z);
      const d = m.size * view.scale * s.p;
      ctx.globalAlpha = m.alpha() * (0.55 + 0.45 * s.p);
      ctx.drawImage(m.sprite, s.x - d / 2, s.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- วงคลื่นแผ่ออกบนพื้นแอ่ง ---------- */
  function createRings() {
    return { list: [], timer: 0 };
  }

  function spawnRing(rings, power) {
    rings.list.push({
      r: 3,
      speed: 11 + Math.random() * 7 + power * 26,
      life: 0,
      max: 2.2,
      power: power
    });
  }

  function drawRings(ctx, view, rings, dt) {
    rings.timer -= dt;
    if (rings.timer <= 0) {
      rings.timer = 1.3 + Math.random() * 0.8;
      spawnRing(rings, 0);
    }

    const c = view.project(0, POOL_Y, 0);
    for (let i = rings.list.length - 1; i >= 0; i--) {
      const g = rings.list[i];
      g.life += dt;
      g.r += g.speed * dt;
      g.speed *= Math.pow(0.985, dt * 60);
      if (g.life > g.max) { rings.list.splice(i, 1); continue; }

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.28);
      ctx.globalAlpha = (1 - g.life / g.max) * (0.18 + g.power * 0.3);
      ctx.strokeStyle = '#bfdbfe';
      ctx.lineWidth = 2.2 + g.power * 3;
      ctx.beginPath();
      ctx.arc(0, 0, g.r * view.scale * c.p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
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
      const y = this.yoff + z * Math.sin(this.tilt);
      return { x: x, y: y, z: z * Math.cos(this.tilt) };
    }
  }

  function createSparks(count) {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(new OrbitSpark(i % 3));
    return arr;
  }

  return {
    POOL_Y: POOL_Y,
    createStars: createStars,
    drawStars: drawStars,
    drawPool: drawPool,
    createMist: createMist,
    drawMist: drawMist,
    createRings: createRings,
    spawnRing: spawnRing,
    drawRings: drawRings,
    createSparks: createSparks
  };
})();
