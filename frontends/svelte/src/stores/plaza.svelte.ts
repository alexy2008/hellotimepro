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

import { api } from "@/api/client";
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSort, PlazaStats } from "@/types";

export const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 9;

class PlazaStore {
  sort = $state<PlazaSort>("new");
  filter = $state<PlazaFilter>("all");
  q = $state("");
  qInput = $state("");
  page = $state(1);

  items = $state.raw<CapsuleListItem[]>([]);
  pagination = $state.raw<Pagination | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);
  counts = $state.raw<PlazaStats["counts"] | null>(null);
  overview = $state.raw<PlazaStats | null>(null);
  featured = $state.raw<CapsuleListItem | null>(null);

  // 请求序列号：只有「最新发起」的请求才回写结果，避免乱序覆盖
  #listSeq = 0;
  #countSeq = 0;
  #debounce = 0;

  async fetchList() {
    const my = ++this.#listSeq;
    this.loading = true;
    this.error = null;
    try {
      const data = await api.plaza({ sort: this.sort, filter: this.filter, q: this.q.trim() || undefined, page: this.page, pageSize: PAGE_SIZE });
      if (my !== this.#listSeq) return;
      this.items = data.items;
      this.pagination = data.pagination;
    } catch (e) {
      // 新查询失败：报本次的错（视图据此显示错误与重试，不再把旧查询的卡片当成这次的结果）
      if (my === this.#listSeq) this.error = e instanceof Error ? e.message : "加载失败";
    } finally {
      if (my === this.#listSeq) this.loading = false;
    }
  }

  async #fetchCounts() {
    const my = ++this.#countSeq;
    try {
      const s = await api.plazaStats(this.q.trim() || undefined);
      if (my === this.#countSeq) this.counts = s.counts;
    } catch {
      /* 数量拿不到时筛选标签上不显示数字 */
    }
  }

  setSort(v: PlazaSort) {
    this.sort = v;
    this.page = 1;
    void this.fetchList();
  }
  setFilter(v: PlazaFilter) {
    this.filter = v;
    this.page = 1;
    void this.fetchList();
  }
  setPage(n: number) {
    this.page = n;
    void this.fetchList();
  }
  /** 立即生效（清空按钮）：顺手取消还在等的防抖 */
  setQ(v: string) {
    clearTimeout(this.#debounce);
    this.qInput = v;
    this.q = v;
    this.page = 1;
    void this.fetchList();
    void this.#fetchCounts();
  }
  /** 搜索框输入：先显示，防抖后再查 */
  typeQ(v: string) {
    this.qInput = v;
    clearTimeout(this.#debounce);
    if (v === this.q) return;
    this.#debounce = window.setTimeout(() => this.setQ(v), SEARCH_DEBOUNCE_MS);
  }

  /** 首页进入、或有胶囊到点开启时：列表、数量、年鉴、精选一起刷新 */
  async refreshAll() {
    await Promise.all([
      this.fetchList(),
      this.#fetchCounts(),
      api
        .plazaStats()
        .then((s) => (this.overview = s))
        .catch(() => undefined),
      api
        .plaza({ sort: "hot", filter: "unopened", page: 1, pageSize: 1 })
        .then((r) => (this.featured = r.items[0] ?? null))
        .catch(() => undefined),
    ]);
  }

  /** 收藏状态在别处变了（卡片、详情页）：同步列表与精选里的这一枚 */
  patchFavorited(capsuleId: string, favoritedByMe: boolean, favoriteCount: number) {
    const patch = (it: CapsuleListItem) => (it.id === capsuleId ? { ...it, favoritedByMe, favoriteCount } : it);
    this.items = this.items.map(patch);
    if (this.featured) this.featured = patch(this.featured);
  }
}

export const plaza = new PlazaStore();
