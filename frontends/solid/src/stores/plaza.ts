// ============================================================
// 广场状态：sort / filter / 关键词 + 分页 + 列表缓存
// ============================================================

import { createStore } from "solid-js/store";
import { api } from "@/api/client";
import type {
  CapsuleListItem,
  Pagination,
  PlazaFilter,
  PlazaSort,
} from "@/types";

interface PlazaStore {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
  page: number;
  pageSize: number;

  items: CapsuleListItem[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
}

const [plaza, setPlaza] = createStore<PlazaStore>({
  sort: "new",
  filter: "all",
  q: "",
  page: 1,
  pageSize: 15,

  items: [],
  pagination: null,
  loading: false,
  error: null,
});

export { plaza };

// 请求序列号：fetch 内仅在自身是「最新发起」时才回写结果，避免乱序覆盖。
// 用闭包变量而非 store state，避免触发额外订阅。
let fetchSeq = 0;

export async function fetchPlaza() {
  const myId = ++fetchSeq;
  setPlaza({ loading: true, error: null });
  try {
    const data = await api.plaza({
      sort: plaza.sort,
      filter: plaza.filter,
      q: plaza.q.trim() || undefined,
      page: plaza.page,
      pageSize: plaza.pageSize,
    });
    // 落后的请求直接丢弃，避免覆盖更新的结果
    if (myId !== fetchSeq) return;
    setPlaza({ items: data.items, pagination: data.pagination, loading: false });
  } catch (e) {
    if (myId !== fetchSeq) return;
    setPlaza({
      loading: false,
      error: e instanceof Error ? e.message : "加载失败",
    });
  }
}

export function setSort(s: PlazaSort) {
  setPlaza({ sort: s, page: 1 });
  void fetchPlaza();
}
export function setFilter(f: PlazaFilter) {
  setPlaza({ filter: f, page: 1 });
  void fetchPlaza();
}
export function setQ(q: string) {
  setPlaza({ q, page: 1 });
  void fetchPlaza();
}
export function setPage(p: number) {
  setPlaza({ page: p });
  void fetchPlaza();
}

export function patchPlazaFavorited(
  capsuleId: string,
  favorited: boolean,
  count: number,
) {
  setPlaza("items", (items) =>
    items.map((it) =>
      it.id === capsuleId
        ? { ...it, favoritedByMe: favorited, favoriteCount: count }
        : it,
    ),
  );
}
