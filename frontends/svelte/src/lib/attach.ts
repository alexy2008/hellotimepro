// ============================================================
// 几个 DOM 小动作，写成 Svelte 附件（{@attach ...}）：
// 附件在元素挂上之后运行，读到的响应式值变了会先清理再重跑，元素移除时清理。
// - slider：分段控件 / 页签 / 导航下面那块跟着当前项滑动的底（thumb / ink）
// - slashFocus：按「/」聚焦搜索框
// - countUp：数字进入视口时从 from 数到 to
// - portal：把元素挪到 <body> 下（全屏仪式层不受 #view 的层叠上下文限制）
// - autofocus：稍等入场动画再聚焦，且不抢用户已经聚焦的控件
// ============================================================

import type { Attachment } from "svelte/attachments";
import { fmt, focusIfIdle, reducedMotion } from "@/lib/fmt";

/** 已经定过位的容器：第一次定位不带过渡，之后的移动才滑过去 */
const placed = new WeakSet<Element>();

/**
 * 量出 box 里当前项（item）的位置，让滑块（thumb）对齐过去。
 * deps 里读到的值（选中项、数量、登录态…）变了就重新量；窗口尺寸变化、字体晚到时也重新量。
 * hideWhenNone：没有当前项时把滑块藏起来（琥珀顶栏在详情页之类没有高亮项）。
 */
export function slider(item: string, thumb: string, deps: () => unknown, hideWhenNone = false): Attachment<HTMLElement> {
  return (box) => {
    deps();
    const place = (animate: boolean) => {
      const t = box.querySelector<HTMLElement>(thumb);
      const a = box.querySelector<HTMLElement>(item);
      if (!t) return;
      if (!a) {
        if (hideWhenNone) t.style.opacity = "0";
        return;
      }
      if (hideWhenNone) t.style.opacity = "1";
      t.style.width = `${a.offsetWidth}px`;
      t.style.transform = `translateX(${a.offsetLeft}px)`;
      t.style.transition = animate ? "" : "none";
    };
    const still = () => place(false);
    place(placed.has(box));
    placed.add(box);
    let alive = true;
    void document.fonts?.ready.then(() => alive && still());
    window.addEventListener("resize", still);
    return () => {
      alive = false;
      window.removeEventListener("resize", still);
    };
  };
}

/** 「/」聚焦这个输入框（正在别的输入框里打字时不抢） */
export const slashFocus: Attachment<HTMLInputElement> = (input) => {
  const onKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName ?? "").toUpperCase();
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
      e.preventDefault();
      input.focus();
    }
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
};

/**
 * 数字进入视口时从 from 数到 to（年鉴用），文字由附件直接写；减少动效时直接显示终值。
 * 元素在模板里留空：<b {@attach countUp(n)}></b>
 */
export function countUp(to: number, from = 0, format: (n: number) => string = fmt.num): Attachment<HTMLElement> {
  return (el) => {
    const show = (n: number) => (el.textContent = format(n));
    if (reducedMotion() || !("IntersectionObserver" in window)) return void show(to);
    show(from);
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 900);
          show(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  };
}

/** 挪到 <body> 下。只用在 {#if} 里的单个根元素上：Svelte 卸载时照样能把它拿掉 */
export const portal: Attachment<HTMLElement> = (el) => {
  document.body.appendChild(el);
  return () => el.remove();
};

/** 稍等入场动画再聚焦 */
export function autofocus(delay = 380): Attachment<HTMLElement> {
  return (el) => {
    const t = setTimeout(() => focusIfIdle(el), delay);
    return () => clearTimeout(t);
  };
}
