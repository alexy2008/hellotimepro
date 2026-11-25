// ============================================================
// 广场状态：查询条件 + 列表 + 统计。两套皮肤共用一份，
// 所以切换皮肤、进出详情页后，筛选、搜索词和页码都还在。
//
// - list：当前条件下的一页卡片
// - counts：筛选标签上的数量（/plaza/stats?q=，随搜索词变化）
// - overview：首页年鉴（/plaza/stats 不带 q）
// - featured：「广场上最受期待的一枚」——最热的未开启胶囊
//
// 首屏数据可以由服务端给（app/page.tsx → PlazaSeed）：seed() 写进来，之后的翻页、筛选、
// 搜索、收藏照常走 /api/v1。服务端以匿名身份取数，登录用户再用 refreshViewer() 补个人投影。
// ============================================================

import { create } from "zustand";
import { api } from "@/api/client";
import { getSessionVersion } from "@/stores/auth";
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSeed, PlazaSort, PlazaStats } from "@/types";

export interface PlazaState {
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
  seedAt: number | null;
  favoriteSession: number | null;
  favoriteFailed: boolean;

  setSort: (s: PlazaSort) => void;
  setFilter: (f: PlazaFilter) => void;
  setQ: (q: string) => void;
  setPage: (p: number) => void;

  /** silent：不进入 loading（补个人投影时卡片照常显示，不闪「加载中」） */
  fetch: (opts?: { silent?: boolean }) => Promise<void>;
  /** 首页进入、或有胶囊到点开启时：列表、数量、年鉴、精选一起刷新 */
  refreshAll: () => Promise<void>;
  /** 登录用户静默重取列表，补上卡片的 favoritedByMe */
  refreshViewer: () => Promise<void>;
  /** 写入服务端给的首屏数据 */
  seed: (s: PlazaSeed) => void;
  patchFavorited: (capsuleId: string, favorited: boolean, count: number) => void;
}

// 请求序列号：只有「最新发起」的请求才回写结果，避免乱序覆盖
let debounce: ReturnType<typeof setTimeout> | undefined;
let listSeq = 0;
let countSeq = 0;
let featuredSeq = 0;
let overviewSeq = 0;

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
  seedAt: null,
  favoriteSession: null,
  favoriteFailed: false,

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

  fetch: async (opts) => {
    const my = ++listSeq;
    const session = getSessionVersion();
    const { sort, filter, q, page, pageSize } = get();
    set({
      favoriteFailed: false,
      favoriteSession: null,
      ...(opts?.silent ? {} : { loading: true, error: null }),
    });
    try {
      const data = await api.plaza({ sort, filter, q: q.trim() || undefined, page, pageSize });
      if (my !== listSeq || session !== getSessionVersion()) return;
      set({ items: data.items, pagination: data.pagination, loading: false, error: null, favoriteSession: session });
    } catch (e) {
      if (my !== listSeq || session !== getSessionVersion()) return;
      // 静默重取失败：保留公开首屏，由收藏按钮提供重试。
      if (opts?.silent) {
        set({ favoriteFailed: true, loading: false });
        return;
      }
      set({ items: [], pagination: null, loading: false, error: e instanceof Error ? e.message : "加载失败" });
    }
  },

  refreshAll: async () => {
    await Promise.all([get().fetch(), fetchCounts(), fetchOverview(), fetchFeatured()]);
  },

  refreshViewer: () => get().fetch({ silent: true }),

  seed: (s) => {
    clearTimeout(debounce);
    // 作废还在路上的旧请求，免得它们晚到覆盖这一屏
    listSeq++;
    countSeq++;
    featuredSeq++;
    overviewSeq++;
    set(seedFields(s));
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

/** 使用与当前查询一致的新首屏。历史导航重用同一份首屏时走常规刷新。 */
export function canUseSeed(s: PlazaState, seed: PlazaSeed): boolean {
  return (
    (s.seedAt === null || seed.generatedAt > s.seedAt) &&
    s.sort === seed.sort &&
    s.filter === seed.filter &&
    s.q === seed.q &&
    s.qInput === seed.q &&
    s.page === seed.page &&
    s.pageSize === seed.pageSize
  );
}

function seedFields(seed: PlazaSeed) {
  return {
    sort: seed.sort,
    filter: seed.filter,
    q: seed.q,
    qInput: seed.q,
    page: seed.page,
    pageSize: seed.pageSize,
    items: seed.items,
    pagination: seed.pagination,
    loading: false,
    error: null,
    counts: seed.counts,
    overview: seed.overview,
    featured: seed.featured,
    seedAt: seed.generatedAt,
    favoriteSession: null,
    favoriteFailed: false,
  };
}

/** 服务端首屏叠加在广场状态上，客户端在 layout effect 中接管。 */
export function overlaySeed(s: PlazaState, seed: PlazaSeed): PlazaState {
  return { ...s, ...seedFields(seed) };
}

function fetchOverview() {
  const my = ++overviewSeq;
  return api.plazaStats().then((overview) => {
    if (my === overviewSeq) usePlaza.setState({ overview });
  }).catch(() => undefined);
}

function fetchFeatured() {
  const my = ++featuredSeq;
  return api
    .plaza({ sort: "hot", filter: "unopened", page: 1, pageSize: 1 })
    .then((r) => {
      if (my === featuredSeq) usePlaza.setState({ featured: r.items[0] ?? null });
    })
    .catch(() => undefined);
}

async function fetchCounts() {
  const my = ++countSeq;
  try {
    const s = await api.plazaStats(usePlaza.getState().q.trim() || undefined);
    if (my === countSeq) usePlaza.setState({ counts: s.counts });
  } catch {
    if (my === countSeq) usePlaza.setState({ counts: null });
  }
}
