// ============================================================
// 首页（广场）的共享逻辑，两套皮肤的首页都用：
// - plazaHome()：路由页面初始化时调用——进入时、登录态变化时把列表、筛选数量、年鉴、精选一起拉一遍；
//   页面上任何一枚胶囊到点开启时，整页数据刷新一次（卡片当场「启封」）
// - 搜索框 300ms 防抖（计时器在 plaza store 里，切皮肤不丢字）；「/」聚焦见 lib/attach 的 slashFocus
// ============================================================

import { untrack } from "svelte";
import { plaza } from "@/stores/plaza.svelte.ts";
import { authStore } from "@/stores/auth.svelte.ts";
import { clock } from "@/stores/clock.svelte.ts";
import { ms, reducedMotion } from "@/lib/fmt";

export function plazaHome() {
  // favoritedByMe 跟着登录态变，所以换了人也要重拉
  $effect(() => {
    void authStore.user?.id;
    untrack(() => void plaza.refreshAll());
  });

  // 到点开启：列表或精选里有胶囊刚好过了开启时刻，就刷新
  const due = $derived(
    [...plaza.items, ...(plaza.featured ? [plaza.featured] : [])].some((c) => !c.isOpened && ms(c.openAt) <= clock.now),
  );
  $effect(() => {
    if (due) untrack(() => void plaza.refreshAll());
  });
}

/** 搜索框里按 Esc：清空并收起焦点 */
export function onSearchKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  plaza.typeQ("");
  (e.target as HTMLInputElement).blur();
}

/** 热度榜前三（只在最热排序、第一页、没有搜索词时标出） */
export const rankOf = (i: number) => (plaza.sort === "hot" && plaza.page === 1 && !plaza.q.trim() && i < 3 ? i + 1 : 0);
export const isMine = (nickname: string) => !!authStore.user && authStore.user.nickname === nickname;

/** 页码列表：首尾两页 + 当前页前后各一页，中间用省略号 */
export function pageNumbers(page: number, total: number): Array<number | "…"> {
  const out: Array<number | "…"> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

/** 平滑滚到广场区（「逛逛胶囊广场」与翻页用） */
export function scrollToPlaza(e?: Event) {
  e?.preventDefault();
  document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}
