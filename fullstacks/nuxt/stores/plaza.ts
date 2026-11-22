// ============================================================
// 广场状态：查询条件 + 列表 + 统计。两套皮肤共用一份，
// 所以切换皮肤、进出详情页后，筛选、搜索词和页码都还在。
//
// - items / pagination：当前条件下的一页卡片
// - counts：筛选标签上的数量（/plaza/stats?q=，随搜索词变化）
// - overview：首页年鉴（/plaza/stats 不带 q）
// - featured：「广场上最受期待的一枚」——最热的未开启胶囊
// - qInput：搜索框里正在敲的字；300ms 防抖后才写进 q。
//   计时器放在 store 里而不是视图里：防抖途中切换皮肤（视图整个换掉）也不会丢字
// ============================================================

import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSort, PlazaStats } from "@/types";

export const SEARCH_DEBOUNCE_MS = 300;

export const usePlazaStore = defineStore("plaza", () => {
  const sort = ref<PlazaSort>("new");
  const filter = ref<PlazaFilter>("all");
  const q = ref("");
  const qInput = ref("");
  const page = ref(1);
  const pageSize = 9;

  const items = ref<CapsuleListItem[]>([]);
  const pagination = ref<Pagination | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const counts = ref<PlazaStats["counts"] | null>(null);
  const overview = ref<PlazaStats | null>(null);
  const featured = ref<CapsuleListItem | null>(null);

  // 请求序列号：只有「最新发起」的请求才回写结果，避免乱序覆盖
  let listSeq = 0;
  let countSeq = 0;
  let debounce = 0;

  async function fetchList() {
    const my = ++listSeq;
    loading.value = true;
    error.value = null;
    try {
      const data = await api.plaza({
        sort: sort.value,
        filter: filter.value,
        q: q.value.trim() || undefined,
        page: page.value,
        pageSize,
      });
      if (my !== listSeq) return;
      items.value = data.items;
      pagination.value = data.pagination;
    } catch (e) {
      if (my === listSeq) {
        items.value = [];
        pagination.value = null;
        error.value = e instanceof Error ? e.message : "加载失败";
      }
    } finally {
      if (my === listSeq) loading.value = false;
    }
  }

  async function fetchCounts() {
    const my = ++countSeq;
    try {
      const s = await api.plazaStats(q.value.trim() || undefined);
      if (my === countSeq) counts.value = s.counts;
    } catch {
      /* 数量拿不到时筛选标签上不显示数字 */
    }
  }

  function setSort(v: PlazaSort) {
    sort.value = v;
    page.value = 1;
    void fetchList();
  }
  function setFilter(v: PlazaFilter) {
    filter.value = v;
    page.value = 1;
    void fetchList();
  }
  function setPage(n: number) {
    page.value = n;
    void fetchList();
  }
  function setQ(v: string) {
    clearTimeout(debounce);
    qInput.value = v;
    q.value = v;
    page.value = 1;
    void fetchList();
    void fetchCounts();
  }
  /** 搜索框输入：先显示，防抖后再查 */
  function typeQ(v: string) {
    qInput.value = v;
    clearTimeout(debounce);
    if (v === q.value) return;
    debounce = window.setTimeout(() => setQ(v), SEARCH_DEBOUNCE_MS);
  }

  /** 首页进入、或有胶囊到点开启时：列表、数量、年鉴、精选一起刷新 */
  async function refreshAll() {
    await Promise.all([
      fetchList(),
      fetchCounts(),
      api
        .plazaStats()
        .then((s) => (overview.value = s))
        .catch(() => undefined),
      api
        .plaza({ sort: "hot", filter: "unopened", page: 1, pageSize: 1 })
        .then((r) => (featured.value = r.items[0] ?? null))
        .catch(() => undefined),
    ]);
  }

  /** 收藏状态在别处变了（卡片、详情页）：同步列表与精选里的这一枚 */
  function patchFavorited(capsuleId: string, favorited: boolean, count: number) {
    for (const it of [...items.value, featured.value]) {
      if (it && it.id === capsuleId) {
        it.favoritedByMe = favorited;
        it.favoriteCount = count;
      }
    }
  }

  return {
    sort,
    filter,
    q,
    qInput,
    page,
    pageSize,
    items,
    pagination,
    loading,
    error,
    counts,
    overview,
    featured,
    setSort,
    setFilter,
    setPage,
    setQ,
    typeQ,
    fetchList,
    refreshAll,
    patchFavorited,
  };
});
