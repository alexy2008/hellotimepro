"use client";

// 广场状态：sort / filter / 关键词 + 分页 + 列表缓存
// 与 frontends/react-ts/src/stores/plaza.ts 对齐

import { create } from "zustand";
import { api } from "@/lib/api-client";
import type {
  CapsuleListItem,
  Pagination,
  PlazaFilter,
  PlazaSort,
} from "@/types";

interface PlazaState {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
  page: number;
  pageSize: number;

  items: CapsuleListItem[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;

  setSort: (s: PlazaSort) => void;
  setFilter: (f: PlazaFilter) => void;
  setQ: (q: string) => void;
  setPage: (p: number) => void;

  fetch: () => Promise<void>;
  patchFavorited: (capsuleId: string, favorited: boolean, count: number) => void;
}

// 请求序列号：fetch 内仅在自身是「最新发起」时才回写结果，避免乱序覆盖。
let fetchSeq = 0;

export const usePlazaStore = create<PlazaState>()((set, get) => ({
  sort: "new",
  filter: "all",
  q: "",
  page: 1,
  pageSize: 15,

  items: [],
  pagination: null,
  loading: false,
  error: null,

  setSort: (s) => {
    set({ sort: s, page: 1 });
    void get().fetch();
  },
  setFilter: (f) => {
    set({ filter: f, page: 1 });
    void get().fetch();
  },
  setQ: (q) => {
    set({ q, page: 1 });
    void get().fetch();
  },
  setPage: (p) => {
    set({ page: p });
    void get().fetch();
  },

  fetch: async () => {
    const myId = ++fetchSeq;
    const { sort, filter, q, page, pageSize } = get();
    set({ loading: true, error: null });
    try {
      const data = await api.plaza({
        sort,
        filter,
        q: q.trim() || undefined,
        page,
        pageSize,
      });
      if (myId !== fetchSeq) return;
      set({
        items: data.items,
        pagination: data.pagination,
        loading: false,
      });
    } catch (e) {
      if (myId !== fetchSeq) return;
      set({
        loading: false,
        error: e instanceof Error ? e.message : "加载失败",
      });
    }
  },

  patchFavorited: (capsuleId, favorited, count) => {
    set((s) => ({
      items: s.items.map((it) =>
        it.id === capsuleId
          ? { ...it, favoritedByMe: favorited, favoriteCount: count }
          : it,
      ),
    }));
  },
}));
