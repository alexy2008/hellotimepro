// ============================================================
// 函数式路由守卫：返回 true 放行，返回 UrlTree 重定向。
// UrlTree 由 router.parseUrl 生成，序列化时 redirect 的值保持 %2F 编码（X7）。
// ============================================================

import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { loginPath, safeRedirect } from '@/lib/redirect';

export const ME_TABS = ['created', 'favorites', 'profile'] as const;
export type MeTab = (typeof ME_TABS)[number];

/** 需要登录：未登录跳 /login?redirect=<当前路径>；本地只剩 refresh token 时先静默续期再判断 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (!auth.user() && auth.refreshToken()) await auth.refreshMe();
  return auth.user() ? true : router.parseUrl(loginPath(state.url));
};

/** 登录 / 注册页：已登录时直接去 ?redirect=（或首页），不破坏当前会话 */
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthStore);
  if (!auth.user()) return true;
  return inject(Router).parseUrl(safeRedirect(route.queryParamMap.get('redirect'), '/'));
};

/** 「我的」只认三个页签，其余回到「我创建的」 */
export const meTabGuard: CanActivateFn = (route) =>
  (ME_TABS as readonly string[]).includes(route.paramMap.get('tab') ?? '') || inject(Router).parseUrl('/me/created');
