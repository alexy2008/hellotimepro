// ============================================================
// 广场状态：查询条件 + 列表 + 统计。两套皮肤共用一份，
// 所以切换皮肤、进出详情页后，筛选、搜索词和页码都还在。
//
// - list：当前条件下的一页卡片
// - counts：筛选标签上的数量（/plaza/stats?q=，随搜索词变化）
// - overview：首页年鉴（/plaza/stats 不带 q）
// - featured：「广场上最受期待的一枚」——最热的未开启胶囊
// ============================================================

import { create } from "zustand";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSort, PlazaStats } from "@/types";

interface PlazaState {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
  qInput: string;
  setQInput: (value: string) => void;
  page: number;
  pageSize: number;

  items: CapsuleListItem[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  counts: PlazaStats["counts"] | null;
  overview: PlazaStats | null;
  featured: CapsuleListItem | null;

  setSort: (s: PlazaSort) => void;
  setFilter: (f: PlazaFilter) => void;
  setQ: (q: string) => void;
  setPage: (p: number) => void;

  fetch: () => Promise<void>;
  /** 首页进入、或有胶囊到点开启时：列表、数量、年鉴、精选一起刷新 */
  refreshAll: () => Promise<void>;
  patchFavorited: (capsuleId: string, favorited: boolean, count: number) => void;
}

// 请求序列号：只有「最新发起」的请求才回写结果，避免乱序覆盖
let debounce: ReturnType<typeof setTimeout> | undefined;
let listSeq = 0;
let countSeq = 0;

export const usePlaza = create<PlazaState>()((set, get) => ({
  sort: "new",
  filter: "all",
  q: "",
  qInput: "",
  page: 1,
  pageSize: 9,

  items: [],
  pagination: null,
  loading: false,
  error: null,
  counts: null,
  overview: null,
  featured: null,

  setSort: (sort) => {
    set({ sort, page: 1, items: [], pagination: null });
    void get().fetch();
  },
  setFilter: (filter) => {
    set({ filter, page: 1, items: [], pagination: null });
    void get().fetch();
  },
  setQInput: (qInput) => {
    clearTimeout(debounce);
    set({ qInput });
    if (qInput !== get().q) debounce = setTimeout(() => get().setQ(qInput), 300);
  },
  setQ: (q) => {
    clearTimeout(debounce);
    set({ q, qInput: q, page: 1, items: [], pagination: null, counts: null });
    void get().fetch();
    void fetchCounts();
  },
  setPage: (page) => {
    set({ page, items: [], pagination: null });
    void get().fetch();
  },

  fetch: async () => {
    const my = ++listSeq;
    const { sort, filter, q, page, pageSize } = get();
    set({ loading: true, error: null });
    try {
      const data = await api.plaza({ sort, filter, q: q.trim() || undefined, page, pageSize });
      if (my !== listSeq) return;
      set({ items: data.items, pagination: data.pagination, loading: false });
    } catch (e) {
      if (my !== listSeq) return;
      set({ items: [], pagination: null, loading: false, error: e instanceof Error ? e.message : "加载失败" });
    }
  },

  refreshAll: async () => {
    await Promise.all([
      get().fetch(),
      fetchCounts(),
      api.plazaStats().then((overview) => set({ overview })).catch(() => undefined),
      api
        .plaza({ sort: "hot", filter: "unopened", page: 1, pageSize: 1 })
        .then((r) => set({ featured: r.items[0] ?? null }))
        .catch(() => undefined),
    ]);
  },

  patchFavorited: (capsuleId, favorited, count) => {
    const patch = (it: CapsuleListItem) =>
      it.id === capsuleId ? { ...it, favoritedByMe: favorited, favoriteCount: count } : it;
    set((s) => ({
      items: s.items.map(patch),
      featured: s.featured ? patch(s.featured) : null,
    }));
  },
}));

async function fetchCounts() {
  const my = ++countSeq;
  try {
    const s = await api.plazaStats(usePlaza.getState().q.trim() || undefined);
    if (my === countSeq) usePlaza.setState({ counts: s.counts });
  } catch {
    if (my === countSeq) usePlaza.setState({ counts: null });
  }
}
