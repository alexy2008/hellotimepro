// ============================================================
// 首页（广场）的共享逻辑，两套皮肤的首页都用它：
// - 进入时、登录态变化时把列表、筛选数量、年鉴、精选一起拉一遍
// - 搜索框 300ms 防抖（计时器在 plaza store 里，切皮肤不丢字）
// - 按「/」聚焦搜索框，Esc 清空
// - 页面上任何一枚胶囊到点开启时，整页数据刷新一次（卡片当场「启封」）
// 视图里的搜索框写 ref="plazaSearch"，这里用 useTemplateRef 拿到它。
// ============================================================

import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch, type MaybeRefOrGetter, toValue } from "vue";
import { usePlazaStore } from "@/stores/plaza";
import { useAuthStore } from "@/stores/auth";
import { useNow } from "@/composables/useNow";
import { ms, reducedMotion } from "@/lib/fmt";

export function usePlazaHome() {
  const plaza = usePlazaStore();
  const auth = useAuthStore();
  const now = useNow();
  const searchEl = useTemplateRef<HTMLInputElement>("plazaSearch");

  // 「/」聚焦搜索
  const onKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName ?? "").toUpperCase();
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
      e.preventDefault();
      searchEl.value?.focus();
    }
  };
  onMounted(() => document.addEventListener("keydown", onKey));
  onBeforeUnmount(() => document.removeEventListener("keydown", onKey));

  // 到点开启：列表或精选里有胶囊刚好过了开启时刻，就刷新
  const due = computed(() =>
    [...plaza.items, ...(plaza.featured ? [plaza.featured] : [])].some((c) => !c.isOpened && ms(c.openAt) <= now.value),
  );
  watch(due, (v) => v && void plaza.refreshAll());

  function clearSearch() {
    plaza.setQ("");
    searchEl.value?.focus();
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    plaza.typeQ("");
    (e.target as HTMLInputElement).blur();
  }

  // 视图里直接 v-model：写入时走 store 的动作（回到第一页、重新查询 / 防抖）
  const sort = computed({ get: () => plaza.sort, set: plaza.setSort });
  const filter = computed({ get: () => plaza.filter, set: plaza.setFilter });
  const qInput = computed({ get: () => plaza.qInput, set: plaza.typeQ });

  /** 热度榜前三（只在最热排序、第一页、没有搜索词时标出） */
  const rankOf = (i: number) => (plaza.sort === "hot" && plaza.page === 1 && !plaza.q.trim() && i < 3 ? i + 1 : 0);
  const isMine = (nickname: string) => !!auth.user && auth.user.nickname === nickname;

  return { plaza, now, sort, filter, qInput, clearSearch, onSearchKey, rankOf, isMine };
}

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

/**
 * 数字进入视口时从 from 数到 to（年鉴用）；减少动效时直接显示终值。
 * 视图里给数字元素写 ref="countEl"。
 */
export function useCountUp(to: MaybeRefOrGetter<number>, from: MaybeRefOrGetter<number> = 0) {
  const el = useTemplateRef<HTMLElement>("countEl");
  const value = ref(toValue(to));
  let io: IntersectionObserver | null = null;
  let raf = 0;

  const stop = () => {
    io?.disconnect();
    io = null;
    cancelAnimationFrame(raf);
  };
  const run = () => {
    stop();
    const target = toValue(to);
    const start = toValue(from);
    if (!el.value || reducedMotion() || !("IntersectionObserver" in window)) {
      value.value = target;
      return;
    }
    io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io?.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 900);
          value.value = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el.value);
  };

  onMounted(run);
  watch(() => [toValue(to), toValue(from)], run);
  onBeforeUnmount(stop);
  return value;
}
