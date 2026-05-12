"use client";

// 胶囊状态：我创建的 + 我收藏的（分页 / 删除 / 收藏切换）
// 与 frontends/react-ts/src/stores/capsule.ts 对齐

import { create } from "zustand";
import { api } from "@/lib/api-client";
import { usePlazaStore } from "./plaza-store";
import type { CapsuleListItem, Pagination } from "@/types";

const PAGE_SIZE = 15;

interface ListSlice {
  items: CapsuleListItem[];
  pagination: Pagination | null;
  page: number;
  loading: boolean;
  error: string | null;
}

const emptySlice = (): ListSlice => ({
  items: [],
  pagination: null,
  page: 1,
  loading: false,
  error: null,
});

interface CapsuleState {
  mine: ListSlice;
  favorites: ListSlice;

  fetchMine: (page?: number) => Promise<void>;
  fetchFavorites: (page?: number) => Promise<void>;
  deleteCapsule: (id: string) => Promise<void>;
  reset: () => void;
}

let mineSeq = 0;
let favSeq = 0;

export const useCapsuleStore = create<CapsuleState>()((set, get) => ({
  mine: emptySlice(),
  favorites: emptySlice(),

  fetchMine: async (page) => {
    const p = page ?? get().mine.page;
    const myId = ++mineSeq;
    set((s) => ({ mine: { ...s.mine, page: p, loading: true, error: null } }));
    try {
      const data = await api.myCapsules(p, PAGE_SIZE);
      if (myId !== mineSeq) return;
      set((s) => ({
        mine: {
          ...s.mine,
          items: data.items,
          pagination: data.pagination,
          loading: false,
        },
      }));
    } catch (e) {
      if (myId !== mineSeq) return;
      set((s) => ({
        mine: {
          ...s.mine,
          loading: false,
          error: e instanceof Error ? e.message : "加载失败",
        },
      }));
    }
  },

  fetchFavorites: async (page) => {
    const p = page ?? get().favorites.page;
    const myId = ++favSeq;
    set((s) => ({
      favorites: { ...s.favorites, page: p, loading: true, error: null },
    }));
    try {
      const data = await api.myFavorites(p, PAGE_SIZE);
      if (myId !== favSeq) return;
      set((s) => ({
        favorites: {
          ...s.favorites,
          items: data.items,
          pagination: data.pagination,
          loading: false,
        },
      }));
    } catch (e) {
      if (myId !== favSeq) return;
      set((s) => ({
        favorites: {
          ...s.favorites,
          loading: false,
          error: e instanceof Error ? e.message : "加载失败",
        },
      }));
    }
  },

  deleteCapsule: async (id) => {
    await api.deleteMyCapsule(id);
    set((s) => ({
      mine: {
        ...s.mine,
        items: s.mine.items.filter((c) => c.id !== id),
      },
    }));
    // 同步广场（如果存在）
    usePlazaStore.setState((ps) => ({
      items: ps.items.filter((c) => c.id !== id),
    }));
  },

  reset: () => {
    mineSeq++;
    favSeq++;
    set({ mine: emptySlice(), favorites: emptySlice() });
  },
}));
