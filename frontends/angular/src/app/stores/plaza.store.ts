// ============================================================
// 广场 Store（NgRx Signal Store）
// ============================================================

import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ApiService } from '@/api/api.service';
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSort } from '@/types';

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
}

let fetchSeq = 0;

export const PlazaStore = signalStore(
  { providedIn: 'root' },
  withState<PlazaState>({
    sort: 'new',
    filter: 'all',
    q: '',
    page: 1,
    pageSize: 15,
    items: [],
    pagination: null,
    loading: false,
    error: null,
  }),
  withMethods((store) => {
    const api = inject(ApiService);
    async function doFetch() {
      const myId = ++fetchSeq;
      const { sort, filter, q, page, pageSize } = {
        sort: store.sort(),
        filter: store.filter(),
        q: store.q(),
        page: store.page(),
        pageSize: store.pageSize(),
      };
      patchState(store, { loading: true, error: null });
      try {
        const data = await api.plaza({
          sort, filter,
          q: q.trim() || undefined,
          page, pageSize,
        });
        if (myId !== fetchSeq) return;
        patchState(store, { items: data.items, pagination: data.pagination, loading: false });
      } catch (e) {
        if (myId !== fetchSeq) return;
        patchState(store, {
          loading: false,
          error: e instanceof Error ? e.message : '加载失败',
        });
      }
    }
    return {
      async fetch() { await doFetch(); },
      setSort(sort: PlazaSort) {
        patchState(store, { sort, page: 1 });
        void doFetch();
      },
      setFilter(filter: PlazaFilter) {
        patchState(store, { filter, page: 1 });
        void doFetch();
      },
      setQ(q: string) {
        patchState(store, { q, page: 1 });
        void doFetch();
      },
      setPage(page: number) {
        patchState(store, { page });
        void doFetch();
      },
      patchFavorited(capsuleId: string, favorited: boolean, count: number) {
        patchState(store, {
          items: store.items().map((it) =>
            it.id === capsuleId
              ? { ...it, favoritedByMe: favorited, favoriteCount: count }
              : it,
          ),
        });
      },
    };
  }),
);
