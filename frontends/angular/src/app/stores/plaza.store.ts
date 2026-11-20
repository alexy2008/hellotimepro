// ============================================================
// 广场状态：查询条件 + 列表 + 统计。两套皮肤共用一份，
// 所以切换皮肤、进出详情页后，筛选、搜索词和页码都还在。
//
// - items / pagination：当前条件下的一页卡片
// - counts：筛选标签上的数量（/plaza/stats?q=，随搜索词变化）
// - overview：首页年鉴（/plaza/stats 不带 q）
// - featured：「广场上最受期待的一枚」——最热的未开启胶囊
// - qInput：搜索框里正在敲的字；用 rxMethod 防抖 300ms 后才写进 q。
//   防抖在 store 里而不是视图里：防抖途中切换皮肤（视图整个换掉）也不会丢字
// ============================================================

import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, filter, map, pipe, switchMap, tap, timer } from 'rxjs';
import { ApiService } from '@/api/api.service';
import type { CapsuleListItem, Pagination, PlazaFilter, PlazaSort, PlazaStats } from '@/types';

export const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 9;

interface PlazaState {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
  qInput: string;
  page: number;
  items: CapsuleListItem[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  counts: PlazaStats['counts'] | null;
  overview: PlazaStats | null;
  featured: CapsuleListItem | null;
}

export const PlazaStore = signalStore(
  { providedIn: 'root' },
  withState<PlazaState>({
    sort: 'new',
    filter: 'all',
    q: '',
    qInput: '',
    page: 1,
    items: [],
    pagination: null,
    loading: false,
    error: null,
    counts: null,
    overview: null,
    featured: null,
  }),
  withMethods((store) => {
    const api = inject(ApiService);
    // 请求序列号：只有「最新发起」的请求才回写结果，避免乱序覆盖
    let listSeq = 0;
    let countSeq = 0;

    async function fetchList() {
      const my = ++listSeq;
      patchState(store, { loading: true, error: null });
      try {
        const data = await api.plaza({
          sort: store.sort(),
          filter: store.filter(),
          q: store.q().trim() || undefined,
          page: store.page(),
          pageSize: PAGE_SIZE,
        });
        if (my === listSeq) patchState(store, { items: data.items, pagination: data.pagination, loading: false });
      } catch (e) {
        if (my === listSeq) patchState(store, { loading: false, error: e instanceof Error ? e.message : '加载失败' });
      }
    }

    async function fetchCounts() {
      const my = ++countSeq;
      try {
        const s = await api.plazaStats(store.q().trim() || undefined);
        if (my === countSeq) patchState(store, { counts: s.counts });
      } catch {
        /* 数量拿不到时筛选标签上不显示数字 */
      }
    }

    function setQ(q: string) {
      patchState(store, { q, qInput: q, page: 1 });
      void fetchList();
      void fetchCounts();
    }

    /** 防抖：每来一个新值就重新计时；null 表示「取消正在等的那一次」 */
    const debounced = rxMethod<string | null>(
      pipe(
        switchMap((v) => (v === null ? EMPTY : timer(SEARCH_DEBOUNCE_MS).pipe(map(() => v)))),
        filter((v) => v !== store.q()),
        tap((v) => setQ(v)),
      ),
    );

    return {
      fetchList,
      setSort(sort: PlazaSort) {
        patchState(store, { sort, page: 1 });
        void fetchList();
      },
      setFilter(f: PlazaFilter) {
        patchState(store, { filter: f, page: 1 });
        void fetchList();
      },
      setPage(page: number) {
        patchState(store, { page });
        void fetchList();
      },
      /** 立即生效（清空按钮）：顺手取消还在等的防抖 */
      setQ(q: string) {
        debounced(null);
        setQ(q);
      },
      /** 搜索框输入：先显示，防抖后再查 */
      typeQ(v: string) {
        patchState(store, { qInput: v });
        debounced(v);
      },

      /** 首页进入、或有胶囊到点开启时：列表、数量、年鉴、精选一起刷新 */
      async refreshAll() {
        await Promise.all([
          fetchList(),
          fetchCounts(),
          api
            .plazaStats()
            .then((overview) => patchState(store, { overview }))
            .catch(() => undefined),
          api
            .plaza({ sort: 'hot', filter: 'unopened', page: 1, pageSize: 1 })
            .then((r) => patchState(store, { featured: r.items[0] ?? null }))
            .catch(() => undefined),
        ]);
      },

      /** 收藏状态在别处变了（卡片、详情页）：同步列表与精选里的这一枚 */
      patchFavorited(capsuleId: string, favoritedByMe: boolean, favoriteCount: number) {
        const patch = (it: CapsuleListItem) => (it.id === capsuleId ? { ...it, favoritedByMe, favoriteCount } : it);
        patchState(store, (s) => ({ items: s.items.map(patch), featured: s.featured ? patch(s.featured) : null }));
      },
    };
  }),
);
