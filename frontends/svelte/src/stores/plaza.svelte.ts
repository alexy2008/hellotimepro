// ============================================================
// 广场状态：sort / filter / 关键词 + 分页 + 列表缓存
// ============================================================

import { api } from "@/api/client";
import type {
  CapsuleListItem,
  Pagination,
  PlazaFilter,
  PlazaSort,
} from "@/types";

class PlazaStore {
  sort = $state<PlazaSort>("new");
  filter = $state<PlazaFilter>("all");
  q = $state("");
  page = $state(1);
  pageSize = $state(15);

  items = $state<CapsuleListItem[]>([]);
  pagination = $state<Pagination | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);

  // 请求序列号：fetch 内仅在自身是「最新发起」时才回写结果，避免快速切换排序时
  // 旧请求的响应覆盖新请求结果。
  #fetchSeq = 0;

  async fetch() {
    const myId = ++this.#fetchSeq;
    this.loading = true;
    this.error = null;
    try {
      const data = await api.plaza({
        sort: this.sort,
        filter: this.filter,
        q: this.q.trim() || undefined,
        page: this.page,
        pageSize: this.pageSize,
      });
      if (myId !== this.#fetchSeq) return;
      this.items = data.items;
      this.pagination = data.pagination;
    } catch (e) {
      if (myId !== this.#fetchSeq) return;
      this.error = e instanceof Error ? e.message : "加载失败";
    } finally {
      if (myId === this.#fetchSeq) this.loading = false;
    }
  }

  setSort(s: PlazaSort) {
    this.sort = s;
    this.page = 1;
    void this.fetch();
  }

  setFilter(f: PlazaFilter) {
    this.filter = f;
    this.page = 1;
    void this.fetch();
  }

  setQ(v: string) {
    this.q = v;
    this.page = 1;
    void this.fetch();
  }

  setPage(p: number) {
    this.page = p;
    void this.fetch();
  }

  patchFavorited(capsuleId: string, favorited: boolean, count: number) {
    this.items = this.items.map((it) =>
      it.id === capsuleId
        ? { ...it, favoritedByMe: favorited, favoriteCount: count }
        : it,
    );
  }
}

export const plazaStore = new PlazaStore();
