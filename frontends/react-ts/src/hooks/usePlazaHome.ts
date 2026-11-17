// ============================================================
// 首页（广场）的共享逻辑，两套皮肤的首页都用它：
// - 进入时把列表、筛选数量、年鉴、精选一起拉一遍
// - 搜索框本地受控，300ms 防抖后写进广场 store
// - 按「/」聚焦搜索框，Esc 清空
// - 页面上任何一枚胶囊到点开启时，整页数据刷新一次（卡片当场「启封」）
// ============================================================

import { useEffect, useRef, useState } from "react";
import { usePlaza } from "@/stores/plaza";
import { useAuth } from "@/stores/auth";
import { useNow } from "@/hooks/useNow";
import { ms, reducedMotion } from "@/lib/fmt";

export function usePlazaHome() {
  const plaza = usePlaza();
  const user = useAuth((s) => s.user);
  const now = useNow();
  const [qInput, setQInput] = useState(plaza.q);
  const searchRef = useRef<HTMLInputElement>(null);

  // 进入首页、登录态变化（favoritedByMe 会变）时刷新
  useEffect(() => {
    void usePlaza.getState().refreshAll();
  }, [user?.id]);

  // 300ms 防抖
  useEffect(() => {
    if (qInput === usePlaza.getState().q) return;
    const t = setTimeout(() => usePlaza.getState().setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // 「/」聚焦搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 到点开启：列表或精选里有胶囊刚好过了开启时刻，就刷新
  const due = [...plaza.items, ...(plaza.featured ? [plaza.featured] : [])].some(
    (c) => !c.isOpened && ms(c.openAt) <= now,
  );
  useEffect(() => {
    if (due) void usePlaza.getState().refreshAll();
  }, [due]);

  const clearSearch = () => {
    setQInput("");
    usePlaza.getState().setQ("");
    searchRef.current?.focus();
  };

  return {
    ...plaza,
    user,
    now,
    qInput,
    setQInput,
    searchRef,
    clearSearch,
    /** 热度榜前三（只在最热排序、第一页、没有搜索词时标出） */
    rankOf: (i: number) => (plaza.sort === "hot" && plaza.page === 1 && !plaza.q.trim() && i < 3 ? i + 1 : 0),
    isMine: (nickname: string) => !!user && user.nickname === nickname,
  };
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

/** 数字进入视口时从 from 数到 to（年鉴用）；减少动效时直接显示终值 */
export function useCountUp(to: number, from = 0) {
  const ref = useRef<HTMLElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) {
      setV(to);
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
          setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
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
  }, [to, from]);
  return { ref, value: v };
}
