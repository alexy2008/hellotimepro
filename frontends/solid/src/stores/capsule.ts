// ============================================================
// 胶囊状态：我创建的 + 我收藏的（分页 / 删除 / 收藏切换）
// ============================================================

import { createStore } from "solid-js/store";
import { api } from "@/api/client";
import { plaza, patchPlazaFavorited } from "@/stores/plaza";
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

interface CapsuleStore {
  mine: ListSlice;
  favorites: ListSlice;
}

const [capsule, setCapsule] = createStore<CapsuleStore>({
  mine: emptySlice(),
  favorites: emptySlice(),
});

export { capsule };

// 序列号：避免并发请求乱序覆盖结果
let mineSeq = 0;
let favSeq = 0;

export async function fetchMine(page?: number) {
  const p = page ?? capsule.mine.page;
  const myId = ++mineSeq;
  setCapsule("mine", { page: p, loading: true, error: null });
  try {
    const data = await api.myCapsules(p, PAGE_SIZE);
    if (myId !== mineSeq) return;
    setCapsule("mine", {
      items: data.items,
      pagination: data.pagination,
      loading: false,
    });
  } catch (e) {
    if (myId !== mineSeq) return;
    setCapsule("mine", {
      loading: false,
      error: e instanceof Error ? e.message : "加载失败",
    });
  }
}

export async function fetchFavorites(page?: number) {
  const p = page ?? capsule.favorites.page;
  const myId = ++favSeq;
  setCapsule("favorites", { page: p, loading: true, error: null });
  try {
    const data = await api.myFavorites(p, PAGE_SIZE);
    if (myId !== favSeq) return;
    setCapsule("favorites", {
      items: data.items,
      pagination: data.pagination,
      loading: false,
    });
  } catch (e) {
    if (myId !== favSeq) return;
    setCapsule("favorites", {
      loading: false,
      error: e instanceof Error ? e.message : "加载失败",
    });
  }
}

export async function deleteCapsule(id: string) {
  await api.deleteMyCapsule(id);
  setCapsule("mine", "items", (items) => items.filter((c) => c.id !== id));
}

export async function toggleFavorite(capsuleId: string, favoritedByMe: boolean) {
  if (favoritedByMe) {
    await api.unfavorite(capsuleId);
    setCapsule("favorites", "items", (items) =>
      items.filter((c) => c.id !== capsuleId),
    );
    // 同步更新广场列表的收藏状态
    const plazaItem = plaza.items.find((i) => i.id === capsuleId);
    const newCount = Math.max(0, (plazaItem?.favoriteCount ?? 1) - 1);
    patchPlazaFavorited(capsuleId, false, newCount);
    return { favoriteCount: newCount };
  } else {
    const result = await api.favorite(capsuleId);
    patchPlazaFavorited(capsuleId, true, result.favoriteCount);
    return { favoriteCount: result.favoriteCount };
  }
}

export function resetCapsules() {
  mineSeq++;
  favSeq++;
  setCapsule({ mine: emptySlice(), favorites: emptySlice() });
}
