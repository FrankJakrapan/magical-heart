/**
 * main.js — ลูปหลัก: กล้อง/การหมุน, สเตตแมชชีนของจังหวะ (รวมร่าง -> นิ่ง -> ระเบิด -> รวมใหม่)
 */
(function () {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });

  // เลเยอร์ละอองที่ลอยหน้ารูป (โปร่งใส วางทับ .tribute)
  const frontCanvas = document.getElementById('front');
  const fctx = frontCanvas.getContext('2d');

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CONFIG = {
    particles: window.innerWidth < 700 ? 1000 : 1800,
    sparks: 76,
    stars: 130,
    mist: window.innerWidth < 700 ? 55 : 95,
    frontDust: window.innerWidth < 700 ? 70 : 130,
    nebula: 8,
    bokeh: window.innerWidth < 700 ? 80 : 170,
    glow: 0.5,               // ความแรงของแสงฟุ้งรอบอนุภาคสว่าง (0 = ปิด)
    beatPeriod: 2.6,         // จังหวะเต้นของหัวใจ (วินาที)
    fov: 90,
    swirlSpeed: 0.95,        // ความเร็วที่ละอองไหลวนอยู่ในรูปหัวใจ
    autoSpin: 0.42,          // ความเร็วหมุนกล้อง (ปิดไว้เป็นค่าเริ่มต้น)
    idleDuration: 6.5,       // วินาทีก่อนระเบิดรอบถัดไป
    burstDuration: 1.3,
    reformDuration: 3.4,
    settleDuration: 1.4,     // ช่วงส่งไม้ต่อจาก reform เข้าสู่ idle
    burstPower: 27
  };

  /* ---------- สถานะฉาก ---------- */
  const view = {
    W: 0, H: 0, cx: 0, cy: 0, scale: 1,
    rotY: 0, rotX: -0.05,
    spin: 0,
    autoSpin: false,          // หัวใจอยู่กับที่ ให้ละอองข้างในหมุนแทน (กด A เพื่อหมุนกล้อง)
    cosY: 1, sinY: 0, cosX: 1, sinX: 0,

    updateMatrix() {
      this.cosY = Math.cos(this.rotY);
      this.sinY = Math.sin(this.rotY);
      this.cosX = Math.cos(this.rotX);
      this.sinX = Math.sin(this.rotX);
    },

    /** model space -> screen space (คืน p ไว้ใช้คุมขนาด/ความสว่างตามระยะลึก) */
    project(x, y, z) {
      const rx = x * this.cosY + z * this.sinY;
      const rz = -x * this.sinY + z * this.cosY;
      const ry = y * this.cosX - rz * this.sinX;
      const rz2 = y * this.sinX + rz * this.cosX;
      const p = CONFIG.fov / (CONFIG.fov + rz2);
      return {
        x: this.cx + rx * this.scale * p,
        y: this.cy - ry * this.scale * p,
        p: p
      };
    }
  };

  let particles = [];
  let sparks = [];
  let stars = [];
  let mist = [];
  let frontDust = [];
  let nebula = [];
  let bokeh = [];
  let rings = Effects.createRings();
  let shooters = Effects.createShooters();
  let beat = 0;             // 0..1 ความแรงของจังหวะเต้น ณ ขณะนั้น

  /* ---------- จังหวะ ---------- */
  const PHASES = {
    assemble: { spring: 24, damping: 0.90, noise: 0 },
    idle:     { spring: 15, damping: 0.85, noise: 1.4 },
    burst:    { spring: 0.8, damping: 0.986, noise: 0 },
    reform:   { spring: 0, damping: 1, noise: 0 },  // reform ขยับด้วย reformStep แทนสปริง
    settle:   { spring: 6, damping: 0.90, noise: 0 }
  };

  let phase = 'assemble';
  let phaseTime = 0;
  let trailFade = 0.30;     // อัลฟาของสี่เหลี่ยมดำที่ทับทุกเฟรม = ความยาวหางเส้น
  let energy = 0;         // 0..1 ใช้ขยายแอ่งแสง/เร่งวงโคจรตอนระเบิด

  function setPhase(name) {
    phase = name;
    phaseTime = 0;
    if (name === 'burst') {
      energy = 1;
      Effects.spawnRing(rings, 1);
      const power = CONFIG.burstPower * (REDUCED ? 0.55 : 1);
      for (const p of particles) p.explode(power * (0.5 + Math.random() * 0.9));
    } else if (name === 'reform') {
      for (const p of particles) p.beginReform();
    }
    if (name === 'burst') setReveal(true);
    else if (name === 'assemble' || name === 'idle') setReveal(false);
  }

  function currentConfig() {
    if (phase === 'settle') {
      // ค่อย ๆ ไล่ค่าเข้าหา idle แทนที่จะสลับทันที ตอนจบการรวมร่างจะได้ไม่สะดุด
      const k = Math.min(phaseTime / CONFIG.settleDuration, 1);
      const e = k * k * (3 - 2 * k);
      const a = PHASES.settle, b = PHASES.idle;
      return {
        spring: a.spring + (b.spring - a.spring) * e,
        damping: a.damping + (b.damping - a.damping) * e,
        noise: b.noise * e
      };
    }
    return PHASES[phase];
  }

  /* ---------- รูป + ข้อความ วางตามขนาดหัวใจจริง ---------- */
  const tribute = document.querySelector('.tribute');
  const captionBlock = document.querySelector('.caption-block');

  /** รูปจะโผล่เฉพาะช่วงที่หัวใจแตกออก แล้วจางหายตอนรวมร่างกลับ */
  function setReveal(on) {
    if (tribute) tribute.classList.toggle('reveal', on);
  }

  function layoutTribute() {
    if (!tribute) return;
    const c = view.project(0, 0, 0);
    const halfH = Heart.HALF_H * view.scale * c.p;
    const halfW = Heart.HALF_W * view.scale * c.p;

    // รูปสูงประมาณครึ่งหนึ่งของหัวใจ กว้างไม่เกินอกหัวใจ
    const photoH = Math.round(halfH * 0.95);
    const photoMaxW = Math.round(halfW * 1.15);
    const cap = Math.max(18, Math.min(56, Math.round(halfW * 0.26)));

    const root = document.documentElement.style;
    root.setProperty('--x', c.x.toFixed(1) + 'px');
    root.setProperty('--y', c.y.toFixed(1) + 'px');
    root.setProperty('--photo-h', photoH + 'px');
    root.setProperty('--photo-max-w', photoMaxW + 'px');
    root.setProperty('--cap', cap + 'px');
    root.setProperty('--cap-y', Math.round(c.y + halfH * 1.05) + 'px');
  }

  /* ---------- resize ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.W = canvas.clientWidth;
    view.H = canvas.clientHeight;
    canvas.width = view.W * dpr;
    canvas.height = view.H * dpr;
    frontCanvas.width = canvas.width;
    frontCanvas.height = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.cx = view.W / 2;
    // จอสูงแคบ (มือถือ) ให้หัวใจใหญ่ขึ้นและวางต่ำลงหน่อย ไม่งั้นจะลอยเล็ก ๆ อยู่ครึ่งบน
    const tall = view.H > view.W * 1.35;
    view.cy = view.H * (tall ? 0.44 : 0.38);
    view.scale = Math.min(view.W / 38, view.H / 56);
    layoutTribute();
    for (const p of particles) { p.px = p.py = null; }
  }

  function build() {
    particles = [];
    for (let i = 0; i < CONFIG.particles; i++) particles.push(new Particle());
    sparks = Effects.createSparks(CONFIG.sparks);
    stars = Effects.createStars(CONFIG.stars);
    mist = Effects.createMist(CONFIG.mist);
    frontDust = Effects.createFrontDust(CONFIG.frontDust);
    nebula = Effects.createNebula(CONFIG.nebula);
    bokeh = Effects.createBokeh(CONFIG.bokeh);
    rings = Effects.createRings();
    shooters = Effects.createShooters();
  }

  /* ---------- อินพุต ---------- */
  let dragging = false, lastPX = 0, lastPY = 0, moved = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastPX = e.clientX;
    lastPY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPX;
    const dy = e.clientY - lastPY;
    lastPX = e.clientX;
    lastPY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    view.rotY += dx * 0.006;
    view.rotX = Math.max(-0.9, Math.min(0.9, view.rotX + dy * 0.004));
    view.spin = dx * 0.06;
  });

  canvas.addEventListener('pointerup', () => {
    if (dragging && moved < 6) trigger();
    dragging = false;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); trigger(); }
    if (e.key === 'a' || e.key === 'A') { view.autoSpin = !view.autoSpin; }
    if (e.key === 'r' || e.key === 'R') { build(); setPhase('assemble'); }
  });

  function trigger() {
    if (phase === 'burst') return;
    setPhase('burst');
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  window.addEventListener('load', () => setTimeout(resize, 60));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
    window.visualViewport.addEventListener('scroll', layoutTribute);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutTribute);

  /* ---------- วาด ---------- */
  function drawParticles(dt, time, cfg, heartScale) {
    ctx.lineCap = 'round';
    // ละอองไหลวนอยู่ในรูป (ตอนระเบิดหมุนไวขึ้น)
    const swirl = CONFIG.swirlSpeed * (1 + energy * 1.2);

    const glow = CONFIG.glow;
    const reforming = phase === 'reform';
    const k = reforming ? Math.min(phaseTime / CONFIG.reformDuration, 1) : 0;
    // ละอองเริ่มปิดล้อมกลับแล้ว ค่อย ๆ ให้รูปจางหายไปก่อนหัวใจเต็มรูป
    if (reforming && k > 0.65) setReveal(false);

    for (const p of particles) {
      p.swirl(dt, swirl);
      if (reforming) p.reformStep(dt, k);
      else p.update(dt, cfg, time);
      const s = view.project(p.x * heartScale, p.y * heartScale, p.z * heartScale);

      // ยิ่งเข้าที่ยิ่งสว่าง -> ตอนบินเข้ารูปจะเห็นเป็นสายแสงจาง ๆ
      const d = p.distanceHome();
      const arrive = (phase === 'burst' || phase === 'settle' || reforming)
        ? 1
        : Math.max(0.06, 1 - d / 22);
      const depth = 0.42 + 0.58 * ((s.p - 0.72) / 0.5);
      const alpha = Math.max(0, Math.min(1, arrive * p.bright * depth));
      const r = p.size * s.p;

      // หางเส้น
      if (p.px !== null) {
        const dx = s.x - p.px, dy = s.y - p.py;
        const len = Math.hypot(dx, dy);
        if (len > 0.6 && len < 260) {
          ctx.globalAlpha = alpha * Math.min(0.55, 0.08 + len * 0.02);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = r * 0.9;
          ctx.beginPath();
          ctx.moveTo(p.px, p.py);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
      }

      // แสงฟุ้ง (สไปรต์แคชไว้แล้ว) + วงฟุ้งใหญ่จาง ๆ เฉพาะเม็ดสว่าง
      const d2 = r * 7;
      if (glow && p.halo) {
        const d3 = d2 * 3.2;
        ctx.globalAlpha = alpha * 0.1 * glow;
        ctx.drawImage(p.halo, s.x - d3 / 2, s.y - d3 / 2, d3, d3);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(p.sprite, s.x - d2 / 2, s.y - d2 / 2, d2, d2);

      p.px = s.x;
      p.py = s.y;
    }
    ctx.globalAlpha = 1;
  }

  function drawSparks(dt) {
    ctx.lineCap = 'round';
    for (const sp of sparks) {
      sp.update(dt, energy);
      const m = sp.position();
      const s = view.project(m.x, m.y, m.z);
      const depth = 0.35 + 0.65 * ((s.p - 0.72) / 0.5);

      if (sp.px !== null) {
        const len = Math.hypot(s.x - sp.px, s.y - sp.py);
        if (len < 200) {
          ctx.globalAlpha = Math.max(0, depth) * 0.5;
          ctx.strokeStyle = sp.color;
          ctx.lineWidth = sp.size * s.p * 1.1;
          ctx.beginPath();
          ctx.moveTo(sp.px, sp.py);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
      }

      const d2 = sp.size * s.p * 7;
      ctx.globalAlpha = Math.max(0, depth);
      ctx.drawImage(Sprites.get(sp.color), s.x - d2 / 2, s.y - d2 / 2, d2, d2);

      sp.px = s.x;
      sp.py = s.y;
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ลูป ---------- */
  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 1 / 30);
    const time = now / 1000;

    phaseTime += dt;
    energy += (0 - energy) * Math.min(1, dt * 1.6);

    // จังหวะเต้นสองครั้งติดกันแบบหัวใจจริง
    const bt = (time % CONFIG.beatPeriod);
    beat = Math.exp(-Math.pow(bt / 0.14, 2)) + 0.55 * Math.exp(-Math.pow((bt - 0.26) / 0.14, 2));
    if (phase === 'burst') beat *= 0.3;

    // เปลี่ยนจังหวะ
    if (phase === 'assemble' && phaseTime > 2.4) setPhase('idle');
    else if (phase === 'idle' && phaseTime > CONFIG.idleDuration * (REDUCED ? 1.7 : 1)) setPhase('burst');
    else if (phase === 'burst' && phaseTime > CONFIG.burstDuration) setPhase('reform');
    else if (phase === 'reform' && phaseTime > CONFIG.reformDuration) setPhase('settle');
    else if (phase === 'settle' && phaseTime > CONFIG.settleDuration) setPhase('idle');

    // กล้อง: ปกติอยู่นิ่ง ส่ายเบา ๆ พอให้มีชีวิต (กด A เปิดหมุนอัตโนมัติ)
    if (!dragging) {
      const target = view.autoSpin ? CONFIG.autoSpin : 0;
      view.spin += (target - view.spin) * Math.min(1, dt * 1.2);
      view.rotY += view.spin * dt;
      if (!view.autoSpin) {
        view.rotY += (Math.sin(time * 0.22) * 0.07 - view.rotY) * Math.min(1, dt * 0.5);
      }
      view.rotX += (Math.sin(time * 0.31) * 0.06 - view.rotX) * Math.min(1, dt * 0.5);
    }
    view.updateMatrix();

    // เคลียร์แบบทิ้งหาง (ตอนระเบิดปล่อยหางยาวขึ้น แล้วค่อย ๆ ไล่กลับ ไม่สลับทันที)
    const fadeTarget = phase === 'burst' ? 0.14 : (phase === 'reform' ? 0.22 : 0.30);
    trailFade += (fadeTarget - trailFade) * Math.min(1, dt * 1.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,' + trailFade.toFixed(3) + ')';
    ctx.fillRect(0, 0, view.W, view.H);

    ctx.globalCompositeOperation = 'lighter';
    Effects.drawNebula(ctx, nebula, view.W, view.H, dt, time);
    Effects.drawStars(ctx, stars, view.W, view.H, time);
    Effects.drawBokeh(ctx, bokeh, view.W, view.H, dt, time);
    Effects.drawAura(ctx, view, 16, beat, energy);
    Effects.drawPool(ctx, view, time, energy);
    Effects.drawMist(ctx, view, mist, dt, energy);
    Effects.drawRings(ctx, view, rings, dt);
    Effects.drawHalo(ctx, view, time, beat);
    drawSparks(dt);
    drawParticles(dt, time, currentConfig(), 1 + beat * 0.035);
    Effects.drawShooters(ctx, shooters, view.W, view.H, dt);

    // เลเยอร์หน้า: ละอองผ่านหน้ารูป
    fctx.clearRect(0, 0, view.W, view.H);
    fctx.globalCompositeOperation = 'lighter';
    Effects.drawFrontDust(fctx, view, frontDust, dt, time);

    requestAnimationFrame(frame);
  }

  resize();
  build();
  setReveal(false);
  requestAnimationFrame(frame);

  // เปิดให้เรียกจากภายนอก/คอนโซลได้
  window.MagicalHeart = {
    view: view,
    config: CONFIG,
    burst: trigger,
    rebuild: function () { build(); setPhase('assemble'); },
    get phase() { return phase; },
    get particles() { return particles; }
  };
})();
