/**
 * effects.js — ฉากหลัง แอ่งแสง หมอกที่พุ่งออกจากแอ่ง วงคลื่น และเส้นแสงวิ่งวน
 */
const Effects = (function () {

  const POOL_Y = -24;          // ระดับแอ่งแสงใน model space
  const MIST_COLORS = ['#60a5fa', '#93c5fd', '#bfdbfe', '#3b82f6'];

  /**
   * สไปรต์ลำแสง: อบทั้งทรงกรวย ขอบฟุ้งซ้ายขวา และการจางขึ้นด้านบนไว้ในภาพเดียว
   * วาดครั้งเดียวตอนโหลด แล้ว drawImage รูปเดียวต่อเฟรม -> ไม่มีขอบคมและไม่มีรอยต่อเป็นชั้น
   */
  const beamSprite = (function () {
    const W = 160, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    for (let row = 0; row < H; row++) {
      const t = row / (H - 1);                    // 0 = ยอด, 1 = โคน
      const halfW = (0.13 + 0.87 * Math.pow(t, 0.85)) * (W / 2);
      const a = Math.pow(t, 1.7) * 0.9;
      const grad = g.createLinearGradient(W / 2 - halfW, 0, W / 2 + halfW, 0);
      grad.addColorStop(0.00, 'rgba(147,197,253,0)');
      grad.addColorStop(0.22, 'rgba(147,197,253,' + (a * 0.28).toFixed(4) + ')');
      grad.addColorStop(0.50, 'rgba(219,234,254,' + (a * 0.65).toFixed(4) + ')');
      grad.addColorStop(0.78, 'rgba(147,197,253,' + (a * 0.28).toFixed(4) + ')');
      grad.addColorStop(1.00, 'rgba(147,197,253,0)');
      g.fillStyle = grad;
      g.fillRect(W / 2 - halfW, row, halfW * 2, 1);
    }
    return c;
  })();

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
    g.addColorStop(0.00, 'rgba(226,247,255,0.78)');
    g.addColorStop(0.32, 'rgba(96,165,250,0.6)');
    g.addColorStop(0.68, 'rgba(37,99,235,0.32)');
    g.addColorStop(1.00, 'rgba(29,78,216,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawBeam(ctx, view, time, energy, base, rx);
  }

  /** ลำแสงนุ่ม ๆ วาดจากสไปรต์รูปเดียว */
  function drawBeam(ctx, view, time, energy, base, rx) {
    const top = view.project(0, -8, 0);
    const span = base.y - top.y;
    if (span <= 0) return;

    const w = rx * 1.15 * (1 + Math.sin(time * 0.5) * 0.03);
    ctx.globalAlpha = 0.42 + energy * 0.3;
    ctx.drawImage(beamSprite, base.x - w / 2, top.y, w, span);
    ctx.globalAlpha = 1;
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

  /* ---------- เนบิวลาพื้นหลัง: ก้อนสีจาง ๆ ลอยช้า ๆ กันฉากโล่ง ---------- */
  const NEBULA_COLORS = ['#1d4ed8', '#312e81', '#0e7490', '#4c1d95', '#1e40af'];

  function createNebula(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const color = NEBULA_COLORS[(Math.random() * NEBULA_COLORS.length) | 0];
      arr.push({
        sprite: Sprites.soft(color),
        x: Math.random(),
        y: Math.random() * 0.85,
        r: 0.35 + Math.random() * 0.55,
        a: 0.10 + Math.random() * 0.12,
        vx: (Math.random() - 0.5) * 0.006,
        vy: -0.002 - Math.random() * 0.004,
        ph: Math.random() * Math.PI * 2,
        sw: 0.12 + Math.random() * 0.2
      });
    }
    return arr;
  }

  function drawNebula(ctx, nebula, W, H, dt, time) {
    const base = Math.max(W, H);
    for (const n of nebula) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.y < -0.4) { n.y = 1.3; n.x = Math.random(); }
      if (n.x < -0.4) n.x = 1.3;
      if (n.x > 1.4) n.x = -0.3;

      const d = n.r * base * (1 + Math.sin(time * n.sw + n.ph) * 0.08);
      ctx.globalAlpha = n.a * (0.75 + 0.25 * Math.sin(time * n.sw * 1.3 + n.ph));
      ctx.drawImage(n.sprite, n.x * W - d / 2, n.y * H - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ลูกแสงฟ้า-ขาวลอยทั่วจอ แบ่งเป็น 3 ระยะให้มีมิติ ---------- */
  const ORB_COLORS = ['#dbeafe', '#bfdbfe', '#93c5fd', '#a5f3fc', '#eff6ff'];

  function createBokeh(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      // 0 = ใกล้ (ใหญ่ เบลอ จาง), 1 = กลาง (ลูกกลมเรืองแสง), 2 = ไกล (เม็ดเล็กคม)
      const r = Math.random();
      const tier = r < 0.22 ? 0 : (r < 0.66 ? 1 : 2);
      const color = ORB_COLORS[(Math.random() * ORB_COLORS.length) | 0];

      arr.push({
        tier: tier,
        sprite: tier === 0 ? Sprites.soft(color)
              : tier === 1 ? Sprites.orb(color)
              : Sprites.get(color),
        x: Math.random(),
        y: Math.random(),
        size: tier === 0 ? 60 + Math.random() * 90
            : tier === 1 ? 10 + Math.random() * 26
            : 3 + Math.random() * 7,
        a: tier === 0 ? 0.05 + Math.random() * 0.07
         : tier === 1 ? 0.14 + Math.random() * 0.24
         : 0.22 + Math.random() * 0.38,
        vy: -(tier === 0 ? 0.010 + Math.random() * 0.014
            : tier === 1 ? 0.006 + Math.random() * 0.012
            : 0.003 + Math.random() * 0.008),
        drift: (tier === 0 ? 0.012 : tier === 1 ? 0.008 : 0.004) * (0.5 + Math.random()),
        ph: Math.random() * Math.PI * 2,
        sw: 0.15 + Math.random() * 0.4
      });
    }
    return arr;
  }

  function drawBokeh(ctx, bokeh, W, H, dt, time) {
    for (const b of bokeh) {
      b.y += b.vy * dt;
      if (b.y < -0.12) { b.y = 1.12; b.x = Math.random(); }
      const x = (b.x + Math.sin(time * b.sw + b.ph) * b.drift) * W;
      const twinkle = b.tier === 2
        ? 0.45 + 0.55 * Math.sin(time * b.sw * 2.4 + b.ph)
        : 0.7 + 0.3 * Math.sin(time * b.sw * 1.3 + b.ph);
      const d = b.size;
      ctx.globalAlpha = b.a * twinkle;
      ctx.drawImage(b.sprite, x - d / 2, b.y * H - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- แสงเรืองรอบหัวใจ เต้นตามจังหวะ ---------- */
  const auraSprite = Sprites.soft('#3b82f6');
  const auraCore = Sprites.soft('#bfdbfe');

  function drawAura(ctx, view, halfW, beat, energy) {
    const c = view.project(0, 0, 0);
    const w = halfW * view.scale * c.p;

    ctx.globalAlpha = 0.22 + beat * 0.18 + energy * 0.12;
    const d1 = w * 3.4;
    ctx.drawImage(auraSprite, c.x - d1 / 2, c.y - d1 / 2, d1, d1);

    ctx.globalAlpha = 0.12 + beat * 0.18;
    const d2 = w * 1.9;
    ctx.drawImage(auraCore, c.x - d2 / 2, c.y - d2 / 2, d2, d2);
    ctx.globalAlpha = 1;
  }

  /* ---------- วงแหวนแสงเอียงรอบหัวใจ ---------- */
  function drawHalo(ctx, view, time, beat) {
    const SEG = 96;
    const radius = 21 + beat * 0.8;
    const tilt = 0.42;
    const spin = time * 0.16;

    ctx.lineWidth = 1.1;
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2 + spin;
      const a1 = ((i + 1) / SEG) * Math.PI * 2 + spin;
      const p0 = ringPoint(view, a0, radius, tilt);
      const p1 = ringPoint(view, a1, radius, tilt);
      // ส่วนที่อยู่ใกล้กล้องสว่างกว่า ได้ความรู้สึกเป็นวงแหวนสามมิติ
      const depth = (p0.p - 0.78) / 0.45;
      ctx.globalAlpha = Math.max(0, Math.min(1, depth)) * (0.13 + beat * 0.14);
      ctx.strokeStyle = i % 8 < 4 ? '#bfdbfe' : '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function ringPoint(view, a, r, tilt) {
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return view.project(x, z * Math.sin(tilt) - 6, z * Math.cos(tilt));
  }

  /* ---------- ละอองที่ลอย "หน้า" รูป ทำให้รูปจมอยู่ในฉากไม่ใช่แปะทับ ---------- */
  function createFrontDust(count) {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(resetDust({}, true));
    return arr;
  }

  function resetDust(d, initial) {
    d.x = (Math.random() - 0.5) * 34;
    d.y = initial ? (Math.random() - 0.5) * 46 : -26 - Math.random() * 4;
    d.z = -12 - Math.random() * 20;              // ติดลบ = อยู่ใกล้กล้องกว่าหัวใจ
    d.vx = (Math.random() - 0.5) * 1.6;
    d.vy = 1.4 + Math.random() * 3.4;
    d.size = 0.5 + Math.random() * 1.8;
    const kind = Math.random();
    d.soft = kind < 0.3;
    d.orb = !d.soft && kind < 0.62;
    d.color = ORB_COLORS[(Math.random() * ORB_COLORS.length) | 0];
    d.sprite = d.soft ? Sprites.soft(d.color)
             : d.orb ? Sprites.orb(d.color)
             : Sprites.get(d.color);
    d.a = d.soft ? 0.1 + Math.random() * 0.12
        : d.orb ? 0.18 + Math.random() * 0.24
        : 0.25 + Math.random() * 0.45;
    d.ph = Math.random() * Math.PI * 2;
    d.sw = 0.4 + Math.random() * 0.9;
    return d;
  }

  function drawFrontDust(ctx, view, dust, dt, time) {
    for (const d of dust) {
      d.y += d.vy * dt;
      d.x += (d.vx + Math.sin(time * d.sw + d.ph) * 0.6) * dt;
      if (d.y > 26) resetDust(d, false);

      const s = view.project(d.x, d.y, d.z);
      const r = d.size * s.p;
      const w = d.soft ? r * 22 : (d.orb ? r * 13 : r * 7);
      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(time * d.sw * 1.7 + d.ph));
      ctx.drawImage(d.sprite, s.x - w / 2, s.y - w / 2, w, w);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ดาวตกเป็นครั้งคราว ---------- */
  function createShooters() {
    return { list: [], timer: 2 + Math.random() * 3 };
  }

  function drawShooters(ctx, sh, W, H, dt) {
    sh.timer -= dt;
    if (sh.timer <= 0) {
      sh.timer = 3.5 + Math.random() * 5;
      const fromLeft = Math.random() < 0.5;
      const speed = 420 + Math.random() * 380;
      const ang = (fromLeft ? 0.35 : Math.PI - 0.35) + (Math.random() - 0.5) * 0.25;
      sh.list.push({
        x: fromLeft ? -60 : W + 60,
        y: Math.random() * H * 0.45,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.55,
        life: 0,
        max: 1.6,
        len: 90 + Math.random() * 120
      });
    }

    for (let i = sh.list.length - 1; i >= 0; i--) {
      const s = sh.list[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life > s.max) { sh.list.splice(i, 1); continue; }

      const k = s.life / s.max;
      const a = Math.sin(Math.PI * k) * 0.75;
      const n = Math.hypot(s.vx, s.vy) || 1;
      const tx = s.x - (s.vx / n) * s.len;
      const ty = s.y - (s.vy / n) * s.len;

      const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grad.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
      grad.addColorStop(0.35, 'rgba(147,197,253,' + (a * 0.45).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(147,197,253,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ขอบจอมืดลง ให้ภาพดูมีมิติ ---------- */
  function drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.28, W / 2, H * 0.5, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(2,6,23,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
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
    createNebula: createNebula,
    drawNebula: drawNebula,
    createBokeh: createBokeh,
    drawBokeh: drawBokeh,
    drawAura: drawAura,
    drawHalo: drawHalo,
    createFrontDust: createFrontDust,
    drawFrontDust: drawFrontDust,
    createShooters: createShooters,
    drawShooters: drawShooters,
    drawVignette: drawVignette,
    drawPool: drawPool,
    createMist: createMist,
    drawMist: drawMist,
    createRings: createRings,
    spawnRing: spawnRing,
    drawRings: drawRings,
    createSparks: createSparks
  };
})();
