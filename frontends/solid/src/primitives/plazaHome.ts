// ============================================================
// 首页（广场）的共享逻辑，由路由页 PlazaPage 创建、交给两套皮肤的首页视图：
// - 进入时、登录态变化（favoritedByMe 会变）时把列表、筛选数量、年鉴、精选一起拉一遍
// - 搜索框的输入与 300ms 防抖在广场 store 里（切皮肤不丢字）
// - 按「/」聚焦搜索框，Esc 清空
// - 页面上任何一枚胶囊到点开启时，整页数据刷新一次（卡片当场「启封」）
// ============================================================

import { createEffect, createMemo, createSignal, on, onCleanup, type Accessor } from "solid-js";
import { auth } from "@/stores/auth";
import { plaza, refreshAll, setQ, setQInput } from "@/stores/plaza";
import { useNow } from "@/primitives/now";
import { ms, reducedMotion } from "@/lib/fmt";

export function createPlazaHome() {
  const now = useNow();
  let searchEl: HTMLInputElement | undefined;

  // 进入首页、登录态变化时刷新（on 只跟踪 user.id，refreshAll 内部的读取不算依赖）
  createEffect(on(() => auth.user?.id, () => void refreshAll()));

  // 「/」聚焦搜索
  const onKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName ?? "").toUpperCase();
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
      e.preventDefault();
      searchEl?.focus();
    }
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  // 到点开启：列表或精选里有胶囊刚好过了开启时刻，就刷新
  const due = createMemo(() =>
    [...plaza.items, ...(plaza.featured ? [plaza.featured] : [])].some((c) => !c.isOpened && ms(c.openAt) <= now()),
  );
  createEffect(on(due, (d) => d && void refreshAll(), { defer: true }));

  return {
    now,
    /** 视图把搜索框交给这里（ref），换皮肤时新视图会重新交一次 */
    searchRef: (el: HTMLInputElement) => (searchEl = el),
    setQInput,
    clearSearch() {
      setQ("");
      searchEl?.focus();
    },
    /** 搜索框里按 Esc：清空并失焦 */
    escSearch(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
      if (e.key !== "Escape") return;
      setQInput("");
      e.currentTarget.blur();
    },
    /** 热度榜前三（只在最热排序、第一页、没有搜索词时标出） */
    rankOf: (i: number) => (plaza.sort === "hot" && plaza.page === 1 && !plaza.q.trim() && i < 3 ? i + 1 : 0),
    isMine: (nickname: string) => !!auth.user && auth.user.nickname === nickname,
  };
}

export type PlazaHome = ReturnType<typeof createPlazaHome>;

/** 页码列表：首尾两页 + 当前页前后各一页，中间用省略号 */
export function pageNumbers(page: number, total: number): Array<number | "…"> {
  const out: Array<number | "…"> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

/**
 * 数字进入视口时从 from 数到 to（年鉴用）；减少动效时直接显示终值。
 * 返回 [ref 回调, 当前显示的值]
 */
export function createCountUp(to: Accessor<number>, from = 0): [(el: HTMLElement) => void, Accessor<number>] {
  const [el, setEl] = createSignal<HTMLElement>();
  const [v, setV] = createSignal(to());
  // createEffect 的第一次运行排在渲染之后，此时 ref 已经交过来了
  createEffect(() => {
    const target = to();
    const node = el();
    if (!node || reducedMotion() || !("IntersectionObserver" in window)) {
      setV(target);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 900);
          setV(Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(node);
    onCleanup(() => {
      io.disconnect();
      cancelAnimationFrame(raf);
    });
  });
  return [setEl, v];
}
