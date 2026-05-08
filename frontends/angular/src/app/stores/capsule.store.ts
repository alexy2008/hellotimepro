// ============================================================
// 胶囊 Store：我创建的 + 我收藏的
// ============================================================

import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ApiService } from '@/api/api.service';
import { PlazaStore } from '@/stores/plaza.store';
import type { CapsuleListItem, Pagination } from '@/types';

interface ListSlice {
  items: CapsuleListItem[];
  pagination: Pagination | null;
  page: number;
  loading: boolean;
  error: string | null;
}

interface CapsuleState {
  mine: ListSlice;
  favorites: ListSlice;
}

function emptySlice(): ListSlice {
  return { items: [], pagination: null, page: 1, loading: false, error: null };
}

const PAGE_SIZE = 15;
let mineSeq = 0;
let favSeq = 0;

export const CapsuleStore = signalStore(
  { providedIn: 'root' },
  withState<CapsuleState>({ mine: emptySlice(), favorites: emptySlice() }),
  withMethods((store) => {
    const api = inject(ApiService);
    const plaza = inject(PlazaStore);
    return {
      async fetchMine(page?: number) {
        const p = page ?? store.mine().page;
        const myId = ++mineSeq;
        patchState(store, { mine: { ...store.mine(), page: p, loading: true, error: null } });
        try {
          const data = await api.myCapsules(p, PAGE_SIZE);
          if (myId !== mineSeq) return;
          patchState(store, {
            mine: { ...store.mine(), items: data.items, pagination: data.pagination, loading: false },
          });
        } catch (e) {
          if (myId !== mineSeq) return;
          patchState(store, {
            mine: { ...store.mine(), loading: false, error: e instanceof Error ? e.message : '加载失败' },
          });
        }
      },
      async fetchFavorites(page?: number) {
        const p = page ?? store.favorites().page;
        const myId = ++favSeq;
        patchState(store, { favorites: { ...store.favorites(), page: p, loading: true, error: null } });
        try {
          const data = await api.myFavorites(p, PAGE_SIZE);
          if (myId !== favSeq) return;
          patchState(store, {
            favorites: { ...store.favorites(), items: data.items, pagination: data.pagination, loading: false },
          });
        } catch (e) {
          if (myId !== favSeq) return;
          patchState(store, {
            favorites: { ...store.favorites(), loading: false, error: e instanceof Error ? e.message : '加载失败' },
          });
        }
      },
      async deleteCapsule(id: string) {
        await api.deleteMyCapsule(id);
        patchState(store, {
          mine: { ...store.mine(), items: store.mine().items.filter((c) => c.id !== id) },
        });
      },
      async toggleFavorite(capsuleId: string, favoritedByMe: boolean): Promise<{ favoriteCount: number }> {
        if (favoritedByMe) {
          await api.unfavorite(capsuleId);
          patchState(store, {
            favorites: {
              ...store.favorites(),
              items: store.favorites().items.filter((c) => c.id !== capsuleId),
            },
          });
          const plazaItem = plaza.items().find((i) => i.id === capsuleId);
          const newCount = Math.max(0, (plazaItem?.favoriteCount ?? 1) - 1);
          plaza.patchFavorited(capsuleId, false, newCount);
          return { favoriteCount: newCount };
        } else {
          const result = await api.favorite(capsuleId);
          plaza.patchFavorited(capsuleId, true, result.favoriteCount);
          return { favoriteCount: result.favoriteCount };
        }
      },
      reset() {
        mineSeq++;
        favSeq++;
        patchState(store, { mine: emptySlice(), favorites: emptySlice() });
      },
    };
  }),
);
