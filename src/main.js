/**
 * main.js — ลูปหลัก: กล้อง/การหมุน, สเตตแมชชีนของจังหวะ (รวมร่าง -> นิ่ง -> ระเบิด -> รวมใหม่)
 */
(function () {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hud = document.querySelector('.hud');

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CONFIG = {
    particles: window.innerWidth < 700 ? 900 : 1500,
    sparks: 54,
    stars: 130,
    fov: 90,
    autoSpin: 0.42,          // เรเดียน/วินาที
    idleDuration: 6.5,       // วินาทีก่อนระเบิดรอบถัดไป
    burstDuration: 1.3,
    reformDuration: 2.8,
    burstPower: 27
  };

  /* ---------- สถานะฉาก ---------- */
  const view = {
    W: 0, H: 0, cx: 0, cy: 0, scale: 1,
    rotY: 0, rotX: -0.12,
    spin: CONFIG.autoSpin,
    autoSpin: !REDUCED,
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

  /* ---------- จังหวะ ---------- */
  const PHASES = {
    assemble: { spring: 24, damping: 0.90, noise: 0 },
    idle:     { spring: 15, damping: 0.85, noise: 1.4 },
    burst:    { spring: 0.8, damping: 0.986, noise: 0 },
    reform:   { spring: 20, damping: 0.90, noise: 0.6 }
  };

  let phase = 'assemble';
  let phaseTime = 0;
  let energy = 0;         // 0..1 ใช้ขยายแอ่งแสง/เร่งวงโคจรตอนระเบิด

  function setPhase(name) {
    phase = name;
    phaseTime = 0;
    if (name === 'burst') {
      energy = 1;
      for (const p of particles) p.explode(CONFIG.burstPower * (0.5 + Math.random() * 0.9));
    }
  }

  function currentConfig() {
    const base = PHASES[phase];
    if (phase === 'reform') {
      // ค่อย ๆ เพิ่มแรงดึงกลับ ให้รวมร่างแบบมีน้ำหนัก
      const k = Math.min(phaseTime / CONFIG.reformDuration, 1);
      return { spring: 3 + k * 22, damping: 0.90, noise: k * 1.0 };
    }
    return base;
  }

  /* ---------- resize ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.W = canvas.clientWidth;
    view.H = canvas.clientHeight;
    canvas.width = view.W * dpr;
    canvas.height = view.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.cx = view.W / 2;
    view.cy = view.H * 0.38;
    view.scale = Math.min(view.W, view.H) / 54;
    for (const p of particles) { p.px = p.py = null; }
  }

  function build() {
    particles = [];
    for (let i = 0; i < CONFIG.particles; i++) particles.push(new Particle());
    sparks = Effects.createSparks(CONFIG.sparks);
    stars = Effects.createStars(CONFIG.stars);
  }

  /* ---------- อินพุต ---------- */
  let dragging = false, lastPX = 0, lastPY = 0, moved = 0;

  function pokeHud() {
    hud.classList.remove('faded');
    clearTimeout(pokeHud.t);
    pokeHud.t = setTimeout(() => hud.classList.add('faded'), 5000);
  }
  pokeHud();

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
    if (e.key === 'a' || e.key === 'A') { view.autoSpin = !view.autoSpin; pokeHud(); }
    if (e.key === 'r' || e.key === 'R') { build(); setPhase('assemble'); }
  });

  function trigger() {
    pokeHud();
    if (phase === 'burst') return;
    setPhase('burst');
  }

  window.addEventListener('resize', resize);

  /* ---------- วาด ---------- */
  function drawParticles(dt, time, cfg) {
    ctx.lineCap = 'round';

    for (const p of particles) {
      p.update(dt, cfg, time);
      const s = view.project(p.x, p.y, p.z);

      // ยิ่งเข้าที่ยิ่งสว่าง -> ตอนบินเข้ารูปจะเห็นเป็นสายแสงจาง ๆ
      const d = p.distanceHome();
      const arrive = phase === 'burst' ? 1 : Math.max(0.06, 1 - d / 22);
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

      // แสงฟุ้ง (สไปรต์แคชไว้แล้ว)
      const d2 = r * 7;
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

    // เปลี่ยนจังหวะ
    if (phase === 'assemble' && phaseTime > 2.4) setPhase('idle');
    else if (phase === 'idle' && !REDUCED && phaseTime > CONFIG.idleDuration) setPhase('burst');
    else if (phase === 'burst' && phaseTime > CONFIG.burstDuration) setPhase('reform');
    else if (phase === 'reform' && phaseTime > CONFIG.reformDuration) setPhase('idle');

    // การหมุน
    if (!dragging) {
      const target = view.autoSpin ? CONFIG.autoSpin : 0;
      view.spin += (target - view.spin) * Math.min(1, dt * 1.2);
      view.rotY += view.spin * dt;
      // ส่ายขึ้นลงเบา ๆ ให้เห็นความหนา
      view.rotX += (Math.sin(time * 0.35) * 0.16 - view.rotX) * Math.min(1, dt * 0.6);
    }
    view.updateMatrix();

    // เคลียร์แบบทิ้งหาง (ตอนระเบิดปล่อยหางยาวขึ้น)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,' + (phase === 'burst' ? 0.14 : 0.30) + ')';
    ctx.fillRect(0, 0, view.W, view.H);

    ctx.globalCompositeOperation = 'lighter';
    Effects.drawStars(ctx, stars, view.W, view.H, time);
    Effects.drawPool(ctx, view, time, energy);
    drawSparks(dt);
    drawParticles(dt, time, currentConfig());

    requestAnimationFrame(frame);
  }

  resize();
  build();
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
