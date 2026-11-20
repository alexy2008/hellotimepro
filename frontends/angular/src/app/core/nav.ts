// ============================================================
// 外壳里两套皮肤共用的逻辑：当前导航项、明暗切换的晕开原点
// ============================================================

import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

export type NavKey = 'plaza' | 'open' | 'create' | 'about' | 'me' | null;

/** 当前路由属于哪个导航项：详情页归在「开启」下，登录注册归在「我的」下（注入上下文里调用） */
export function injectNavKey(): Signal<NavKey> {
  const router = inject(Router);
  const url = toSignal(
    router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => router.url),
    ),
    { initialValue: router.url },
  );
  return computed(() => {
    const p = url().split(/[?#]/)[0];
    if (p === '/') return 'plaza';
    if (p === '/open' || p.startsWith('/capsules/')) return 'open';
    if (p === '/create') return 'create';
    if (p === '/about') return 'about';
    if (p.startsWith('/me') || p === '/login' || p === '/register') return 'me';
    return null;
  });
}

/** 明暗切换从点击位置晕开；键盘触发（坐标为 0）时从按钮中心晕开 */
export function themeOrigin(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const kb = e.clientX === 0 && e.clientY === 0;
  return { x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY };
}
