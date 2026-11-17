/* ============================================================
   背景粒子：随主题变化
   · 星夜 —— 闪烁的星星，偶尔划过一颗流星
   · 晨曦 —— 阳光里缓缓上浮的金色微尘
   标签页切到后台时暂停；「减少动态效果」时只画一帧静态画面
   ============================================================ */
(function (HT) {
  'use strict';
  const canvas = document.getElementById('sky');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  const STAR = ['255,255,255', '255,255,255', '200,214,255', '255,226,180'];
  const MOTE = ['236,150,40', '245,176,66', '214,120,60', '160,130,240'];
  let w = 0, h = 0, parts = [], meteor = null, nextMeteor = 0, frame = 0, dark = true;

  function populate() {
    const n = Math.max(70, Math.min(dark ? 230 : 90, Math.round((w * h) / (dark ? 7000 : 20000))));
    const rnd = Math.random;
    parts = Array.from({ length: n }, () => dark
      ? { x: rnd() * w, y: rnd() * h, r: rnd() < 0.08 ? 1.3 + rnd() * 0.8 : 0.35 + rnd() * 0.85, a: 0.3 + rnd() * 0.6, sp: 0.4 + rnd() * 1.6, ph: rnd() * 6.28, vx: 0.012 + rnd() * 0.03, vy: 0, c: STAR[(rnd() * STAR.length) | 0] }
      : { x: rnd() * w, y: rnd() * h, r: 1 + rnd() * 3.2, a: 0.1 + rnd() * 0.26, sp: 0.2 + rnd() * 0.7, ph: rnd() * 6.28, vx: (rnd() - 0.5) * 0.12, vy: -(0.05 + rnd() * 0.2), c: MOTE[(rnd() * MOTE.length) | 0] });
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    populate();
  }
  function drawMeteor(now) {
    if (!meteor && now >= nextMeteor) {
      meteor = { x: w * (0.35 + Math.random() * 0.6), y: -20, vx: -(5 + Math.random() * 3), vy: 3 + Math.random() * 2, life: 0, max: 70 + Math.random() * 30 };
    }
    if (!meteor) return;
    meteor.x += meteor.vx; meteor.y += meteor.vy; meteor.life += 1;
    const fade = Math.sin((meteor.life / meteor.max) * Math.PI);
    const tx = meteor.x - meteor.vx * 16, ty = meteor.y - meteor.vy * 16;
    const g = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
    g.addColorStop(0, `rgba(255,244,220,${0.9 * fade})`);
    g.addColorStop(1, 'rgba(255,244,220,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(meteor.x, meteor.y); ctx.lineTo(tx, ty); ctx.stroke();
    if (meteor.life >= meteor.max) { meteor = null; nextMeteor = now + 6000 + Math.random() * 9000; }
  }
  function draw(now) {
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      let a = p.a;
      if (dark) {
        a *= 0.55 + 0.45 * Math.sin(t * p.sp + p.ph);
        p.x += p.vx; if (p.x > w + 4) p.x = -4;
      } else {
        p.x += p.vx + Math.sin(t * p.sp + p.ph) * 0.12; p.y += p.vy;
        if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8; if (p.x > w + 8) p.x = -8;
      }
      ctx.beginPath(); ctx.fillStyle = `rgba(${p.c},${Math.max(0, a).toFixed(3)})`;
      ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    }
    if (dark) drawMeteor(now);
    frame = requestAnimationFrame(draw);
  }
  function start() {
    cancelAnimationFrame(frame);
    dark = document.documentElement.dataset.theme !== 'light';
    nextMeteor = performance.now() + 3000 + Math.random() * 4000;
    resize();
    if (HT.reduced()) { draw(performance.now()); cancelAnimationFrame(frame); }
    else frame = requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    if (!document.hidden && !HT.reduced()) frame = requestAnimationFrame(draw);
  });
  HT.bus.on('theme', start);
  start();
})(window.HT);
