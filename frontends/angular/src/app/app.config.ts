// ============================================================
// 应用级配置：路由（守卫、标题策略、换页回顶）、变更检测、启动时恢复登录态
// ============================================================

import { type ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { SuffixTitleStrategy } from '@/core/title.strategy';
import { AuthStore } from '@/stores/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: TitleStrategy, useClass: SuffixTitleStrategy },
    // 第一次导航之前创建 AuthStore：它在 onInit 里从 localStorage 恢复登录态，
    // 守卫（未登录跳登录、已登录访问登录 / 注册页跳走）第一帧就能拿到正确的 user
    provideAppInitializer(() => void inject(AuthStore)),
  ],
};
