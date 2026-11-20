// ============================================================
// 首页（广场）的页面逻辑，由 HomePage 提供、两套皮肤的首页注入同一份：
// - 进入时、登录态变化时把列表、筛选数量、年鉴、精选一起拉一遍
// - 页面上任何一枚胶囊到点开启时，整页数据刷新一次（卡片当场「启封」）
// 广场的查询条件与数据在 PlazaStore（全局），离开首页再回来还在。
// ============================================================

import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { PlazaStore } from '@/stores/plaza.store';
import { AuthStore } from '@/stores/auth.store';
import { injectNow } from '@/core/clock';
import { ms, reducedMotion } from '@/lib/fmt';

@Injectable()
export class HomeFacade {
  readonly plaza = inject(PlazaStore);
  private readonly auth = inject(AuthStore);
  readonly now = injectNow();

  /** 列表或精选里有胶囊刚好过了开启时刻 */
  private readonly due = computed(() =>
    [...this.plaza.items(), ...(this.plaza.featured() ? [this.plaza.featured()!] : [])].some(
      (c) => !c.isOpened && ms(c.openAt) <= this.now(),
    ),
  );

  constructor() {
    // favoritedByMe 跟着登录态变，所以换了人也要重拉
    effect(() => {
      this.auth.user()?.id;
      untracked(() => void this.plaza.refreshAll());
    });
    effect(() => {
      if (this.due()) untracked(() => void this.plaza.refreshAll());
    });
  }

  /** 热度榜前三（只在最热排序、第一页、没有搜索词时标出） */
  rankOf(i: number) {
    return this.plaza.sort() === 'hot' && this.plaza.page() === 1 && !this.plaza.q().trim() && i < 3 ? i + 1 : 0;
  }

  isMine(nickname: string) {
    return this.auth.user()?.nickname === nickname;
  }

  goPage(n: number) {
    this.plaza.setPage(n);
    scrollToPlaza();
  }
}

/** 页码列表：首尾两页 + 当前页前后各一页，中间用省略号 */
export function pageNumbers(page: number, total: number): Array<number | '…'> {
  const out: Array<number | '…'> = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

/** 平滑滚到广场区（「逛逛胶囊广场」与翻页用） */
export function scrollToPlaza(e?: Event) {
  e?.preventDefault();
  document.getElementById('plaza')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
