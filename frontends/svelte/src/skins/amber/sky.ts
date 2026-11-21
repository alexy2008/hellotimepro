// ============================================================
// 「琥珀」背景的粒子画布（框架无关的命令式绘制，组件只管启停）
// · 星夜 —— 闪烁的星星，偶尔划过一颗流星
// · 晨曦 —— 阳光里缓缓上浮的金色微尘
// 标签页切到后台时暂停；减少动效时只画一帧
// ============================================================

import { reducedMotion } from "@/lib/fmt";

const STAR = ["255,255,255", "255,255,255", "200,214,255", "255,226,180"];
const MOTE = ["236,150,40", "245,176,66", "214,120,60", "160,130,240"];

interface P {
  x: number; y: number; r: number; a: number; sp: number; ph: number; vx: number; vy: number; c: string;
}

export function startSky(canvas: HTMLCanvasElement, dark: boolean): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  let w = 0, h = 0, frame = 0;
  let parts: P[] = [];
  let meteor: { x: number; y: number; vx: number; vy: number; life: number; max: number } | null = null;
  let nextMeteor = performance.now() + 3000 + Math.random() * 4000;

  const populate = () => {
    const n = Math.max(70, Math.min(dark ? 230 : 90, Math.round((w * h) / (dark ? 7000 : 20000))));
    const r = Math.random;
    parts = Array.from({ length: n }, () =>
      dark
        ? { x: r() * w, y: r() * h, r: r() < 0.08 ? 1.3 + r() * 0.8 : 0.35 + r() * 0.85, a: 0.3 + r() * 0.6, sp: 0.4 + r() * 1.6, ph: r() * 6.28, vx: 0.012 + r() * 0.03, vy: 0, c: STAR[(r() * STAR.length) | 0] }
        : { x: r() * w, y: r() * h, r: 1 + r() * 3.2, a: 0.1 + r() * 0.26, sp: 0.2 + r() * 0.7, ph: r() * 6.28, vx: (r() - 0.5) * 0.12, vy: -(0.05 + r() * 0.2), c: MOTE[(r() * MOTE.length) | 0] },
    );
  };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    populate();
  };
  const drawMeteor = (now: number) => {
    if (!meteor && now >= nextMeteor) {
      meteor = { x: w * (0.35 + Math.random() * 0.6), y: -20, vx: -(5 + Math.random() * 3), vy: 3 + Math.random() * 2, life: 0, max: 70 + Math.random() * 30 };
    }
    if (!meteor) return;
    meteor.x += meteor.vx;
    meteor.y += meteor.vy;
    meteor.life += 1;
    const fade = Math.sin((meteor.life / meteor.max) * Math.PI);
    const tx = meteor.x - meteor.vx * 16, ty = meteor.y - meteor.vy * 16;
    const g = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
    g.addColorStop(0, `rgba(255,244,220,${0.9 * fade})`);
    g.addColorStop(1, "rgba(255,244,220,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(meteor.x, meteor.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    if (meteor.life >= meteor.max) {
      meteor = null;
      nextMeteor = now + 6000 + Math.random() * 9000;
    }
  };
  const draw = (now: number) => {
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      let a = p.a;
      if (dark) {
        a *= 0.55 + 0.45 * Math.sin(t * p.sp + p.ph);
        p.x += p.vx;
        if (p.x > w + 4) p.x = -4;
      } else {
        p.x += p.vx + Math.sin(t * p.sp + p.ph) * 0.12;
        p.y += p.vy;
        if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.c},${Math.max(0, a).toFixed(3)})`;
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    if (dark) drawMeteor(now);
    frame = requestAnimationFrame(draw);
  };
  const play = () => {
    cancelAnimationFrame(frame);
    if (reducedMotion()) {
      draw(performance.now());
      cancelAnimationFrame(frame);
    } else if (!document.hidden) frame = requestAnimationFrame(draw);
  };

  resize();
  play();
  const onResize = () => resize();
  const onVis = () => (document.hidden ? cancelAnimationFrame(frame) : play());
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    ctx.clearRect(0, 0, w, h);
  };
}
