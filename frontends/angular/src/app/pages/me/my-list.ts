// ============================================================
// 我创建的 / 我收藏的：一页 20 枚，「加载更多」往后接（列表一直按时间倒序）。
// 注入函数：在组件字段初始化时调用 injectMyList('created', () => …)，随组件销毁作废进行中的请求。
// ============================================================

import { computed, DestroyRef, inject, signal, type Type } from '@angular/core';
import { ApiService } from '@/api/api.service';
import { FeedbackStore } from '@/stores/feedback.store';
import { DeleteBodyComponent } from '@/shared/delete-body.component';
import { ApiError, type CapsuleListItem } from '@/types';

const PAGE_SIZE = 20;

export function injectMyList(kind: 'created' | 'favorites', onChange?: () => void) {
  const api = inject(ApiService);
  const feedback = inject(FeedbackStore);
  const items = signal<CapsuleListItem[] | null>(null);
  const total = signal(0);
  const moreBusy = signal(false);
  let seq = 0;
  inject(DestroyRef).onDestroy(() => seq++);

  const fetchPage = (n: number) => (kind === 'created' ? api.myCapsules(n, PAGE_SIZE) : api.myFavorites(n, PAGE_SIZE));

  async function load() {
    const my = ++seq;
    try {
      const r = await fetchPage(1);
      if (my !== seq) return;
      items.set(r.items);
      total.set(r.pagination.total);
    } catch {
      /* 列表拿不到时保持空白，等下次进来 */
    }
  }
  void load();

  const drop = (id: string) => {
    seq++;
    moreBusy.set(false);
    items.update((list) => (list ?? []).filter((i) => i.id !== id));
    total.update((t) => Math.max(0, t - 1));
    if (!items()?.length && total() > 0) void load();
  };

  return {
    items: items.asReadonly(),
    total: total.asReadonly(),
    moreBusy: moreBusy.asReadonly(),
    hasMore: computed(() => !!items() && items()!.length < total()),
    left: computed(() => total() - (items()?.length ?? 0)),

    /** 从已显示的条数推算下一条所在的页；删除后重读边界页，补上前移的记录。 */
    async loadMore() {
      if (moreBusy()) return;
      const my = seq;
      moreBusy.set(true);
      try {
        const r = await fetchPage(Math.floor((items()?.length ?? 0) / PAGE_SIZE) + 1);
        if (my !== seq) return;
        const have = new Set((items() ?? []).map((i) => i.id));
        items.update((list) => [...(list ?? []), ...r.items.filter((i) => !have.has(i.id))]);
        total.set(r.pagination.total);
      } catch {
        if (my === seq) feedback.toast('加载失败，请稍后再试', { tone: 'error' });
      } finally {
        if (my === seq) moreBusy.set(false);
      }
    },

    /** 删除：确认框写明后果（spec/ui/copy.md §3）；mark 是各皮肤的小插画 */
    async remove(c: CapsuleListItem, mark?: { component: Type<unknown>; inputs?: Record<string, unknown> }) {
      const ok = await feedback.confirm({
        title: '删除这枚胶囊？',
        body: { component: DeleteBodyComponent, inputs: { title: c.title, code: c.code } },
        confirm: '删除',
        cancel: '再想想',
        tone: 'danger',
        mark,
      });
      if (!ok) return false;
      try {
        await api.deleteMyCapsule(c.id);
        drop(c.id);
        feedback.toast(`已删除《${c.title}》`);
        onChange?.();
        return true;
      } catch (e) {
        feedback.toast(e instanceof ApiError ? e.message : '删除失败，请稍后再试', { tone: 'error' });
        return false;
      }
    },

    /** 在「我收藏的」里取消收藏：从列表里拿掉 */
    onFavChange(id: string, favorited: boolean) {
      if (kind === 'favorites' && !favorited) drop(id);
      onChange?.();
    },
  };
}
