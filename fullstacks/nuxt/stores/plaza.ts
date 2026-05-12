// ============================================================
// 广场状态：sort / filter / 关键词 + 分页 + 列表缓存
// ============================================================

import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/client";
import type {
  CapsuleListItem,
  Pagination,
  PlazaFilter,
  PlazaSort,
} from "@/types";

export const usePlazaStore = defineStore("plaza", () => {
  const sort = ref<PlazaSort>("new");
  const filter = ref<PlazaFilter>("all");
  const q = ref("");
  const page = ref(1);
  const pageSize = ref(15);

  const items = ref<CapsuleListItem[]>([]);
  const pagination = ref<Pagination | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 请求序列号：fetch 内仅在自身是「最新发起」时才回写结果，避免快速切换排序时
  // 旧请求的响应覆盖新请求结果。用闭包变量而非 ref，避免触发不必要的订阅 re-render。
  let fetchSeq = 0;

  async function fetch() {
    const myId = ++fetchSeq;
    loading.value = true;
    error.value = null;
    try {
      const data = await api.plaza({
        sort: sort.value,
        filter: filter.value,
        q: q.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value,
      });
      // 落后的请求直接丢弃
      if (myId !== fetchSeq) return;
      items.value = data.items;
      pagination.value = data.pagination;
    } catch (e) {
      if (myId !== fetchSeq) return;
      error.value = e instanceof Error ? e.message : "加载失败";
    } finally {
      // 仅最新请求负责切回 loading=false，避免被旧请求误关
      if (myId === fetchSeq) loading.value = false;
    }
  }

  function setSort(s: PlazaSort) {
    sort.value = s;
    page.value = 1;
    void fetch();
  }
  function setFilter(f: PlazaFilter) {
    filter.value = f;
    page.value = 1;
    void fetch();
  }
  function setQ(v: string) {
    q.value = v;
    page.value = 1;
    void fetch();
  }
  function setPage(p: number) {
    page.value = p;
    void fetch();
  }

  function patchFavorited(capsuleId: string, favorited: boolean, count: number) {
    items.value = items.value.map((it) =>
      it.id === capsuleId
        ? { ...it, favoritedByMe: favorited, favoriteCount: count }
        : it,
    );
  }

  return {
    sort,
    filter,
    q,
    page,
    pageSize,
    items,
    pagination,
    loading,
    error,
    fetch,
    setSort,
    setFilter,
    setQ,
    setPage,
    patchFavorited,
  };
});
