// ============================================================
// 广场状态：查询条件 + 列表 + 统计。两套皮肤共用一份，
// 所以切换皮肤、进出详情页后，筛选、搜索词和页码都还在。
//
// - items：当前条件下的一页卡片（reconcile 按 id 对齐，刷新时同一枚胶囊的 DOM 不重建）
// - counts：筛选标签上的数量（/plaza/stats?q=，随搜索词变化）
// - overview：首页年鉴（/plaza/stats 不带 q）
// - featured：「广场上最受期待的一枚」——最热的未开启胶囊
// - qInput：搜索框里正在输入的字；300ms 防抖后才成为 q。计时器也放在这里，
//   输入后不到 300ms 就切皮肤（视图整个换掉）也不会丢掉最后几个字
// ============================================================

import { batch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSort, PlazaStats } from "@/types";

interface PlazaState {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
  qInput: string;
  page: number;
  pageSize: number;

  items: CapsuleListItem[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  counts: PlazaStats["counts"] | null;
  overview: PlazaStats | null;
  featured: CapsuleListItem | null;
}

const [plaza, setPlaza] = createStore<PlazaState>({
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
});

/** 只读的广场状态，改动一律走下面的动作函数 */
export { plaza };

// 请求序列号：只有「最新发起」的请求才回写结果，避免乱序覆盖
let listSeq = 0;
let countSeq = 0;
let overviewSeq = 0;
let featuredSeq = 0;
let debounce = 0;

export function setSort(sort: PlazaSort) {
  setPlaza({ sort, page: 1 });
  void fetchList(true);
}

export function setFilter(filter: PlazaFilter) {
  setPlaza({ filter, page: 1 });
  void fetchList(true);
}

export function setPage(page: number) {
  setPlaza({ page });
  void fetchList(true);
}

export function setQ(q: string) {
  clearTimeout(debounce);
  if (q.trim() !== plaza.q.trim()) setPlaza("counts", null);
  setPlaza({ q, qInput: q, page: 1 });
  void fetchList(true);
  void fetchCounts();
}

/** 搜索框输入：300ms 防抖后写成 q */
export function setQInput(v: string) {
  setPlaza("qInput", v);
  clearTimeout(debounce);
  if (v !== plaza.q) debounce = window.setTimeout(() => setQ(v), 300);
}

async function fetchList(resetResults = false): Promise<void> {
  const my = ++listSeq;
  const { sort, filter, q, page, pageSize } = plaza;
  setPlaza({ loading: true, error: null, ...(resetResults ? { items: [], pagination: null } : {}) });
  try {
    const data = await api.plaza({ sort, filter, q: q.trim() || undefined, page, pageSize });
    if (my !== listSeq) return;
    const lastPage = Math.max(1, data.pagination.totalPages);
    if (page > lastPage) {
      setPlaza("page", lastPage);
      return fetchList(true);
    }
    batch(() => {
      setPlaza("items", reconcile(data.items, { key: "id" }));
      setPlaza({ pagination: data.pagination, loading: false });
    });
  } catch (e) {
    if (my !== listSeq) return;
    setPlaza({ items: [], pagination: null, loading: false, error: e instanceof Error ? e.message : "加载失败" });
  }
}

async function fetchCounts() {
  const my = ++countSeq;
  try {
    const s = await api.plazaStats(plaza.q.trim() || undefined);
    if (my === countSeq) setPlaza("counts", s.counts);
  } catch {
    if (my === countSeq) setPlaza("counts", null);
  }
}

async function fetchFeatured() {
  const my = ++featuredSeq;
  try {
    const result = await api.plaza({ sort: "hot", filter: "unopened", page: 1, pageSize: 1 });
    if (my === featuredSeq) setPlaza("featured", result.items[0] ? reconcile(result.items[0]) : null);
  } catch {
    // 保留上一次成功取得的精选。
  }
}

/** 首页进入、或有胶囊到点开启时：列表、数量、年鉴、精选一起刷新 */
export async function refreshAll(resetResults = false) {
  const my = ++overviewSeq;
  await Promise.all([
    fetchList(resetResults),
    fetchCounts(),
    api
      .plazaStats()
      .then((overview) => {
        if (my === overviewSeq) setPlaza("overview", overview);
      })
      .catch(() => undefined),
    fetchFeatured(),
  ]);
}

/** 某处收藏 / 取消收藏后，同步广场列表与精选里的这一枚（只改这两个字段，卡片不重建） */
export function patchFavorited(capsuleId: string, favorited: boolean, count: number) {
  const patch = { favoritedByMe: favorited, favoriteCount: count };
  setPlaza("items", (it) => it.id === capsuleId, patch);
  if (plaza.featured?.id === capsuleId) setPlaza("featured", patch);

  // 热度影响跨页排名与首页精选，由服务端按最新票数重新排序。
  if (plaza.sort === "hot" || plaza.loading) void fetchList();
  void fetchFeatured();
}
