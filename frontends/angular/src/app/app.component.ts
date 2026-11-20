// ============================================================
// 总布局：按当前皮肤挑外壳，中间是路由页面。
// 外壳的 DOM 约定照 2.0 原型：header.hdr / main#view / footer.ftr / nav.tabbar，
// 皮肤样式里有 #view、body[data-route] 等选择器依赖这些约定。
// 外壳部件都用属性选择器长在原型元素上（<header appPaperHeader>），不多出包装层。
// ============================================================

import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { UiStore } from '@/stores/ui.store';
import { AuthStore } from '@/stores/auth.store';
import { loginPath } from '@/lib/redirect';
import { ToastHostComponent } from '@/shared/toast-host.component';
import { DialogHostComponent } from '@/shared/dialog-host.component';
import { PaperFiltersComponent } from '@/skins/paper/parts/filters.component';
import { PaperHeaderComponent } from '@/skins/paper/shell/header.component';
import { PaperFooterComponent } from '@/skins/paper/shell/footer.component';
import { PaperTabBarComponent } from '@/skins/paper/shell/tab-bar.component';
import { AmberBackdropComponent } from '@/skins/amber/shell/backdrop.component';
import { AmberHeaderComponent } from '@/skins/amber/shell/header.component';
import { AmberFooterComponent } from '@/skins/amber/shell/footer.component';
import { AmberTabBarComponent } from '@/skins/amber/shell/tab-bar.component';

/** 路由名：写到 body[data-route]，个别皮肤样式按页面微调 */
function routeName(path: string): string {
  if (path === '/') return 'plaza';
  if (path.startsWith('/capsules/')) return 'capsule';
  if (path.startsWith('/me')) return 'me';
  return path.slice(1).split('/')[0] || 'plaza';
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastHostComponent,
    DialogHostComponent,
    PaperFiltersComponent,
    PaperHeaderComponent,
    PaperFooterComponent,
    PaperTabBarComponent,
    AmberBackdropComponent,
    AmberHeaderComponent,
    AmberFooterComponent,
    AmberTabBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-paper-filters />
    <app-amber-backdrop />
    <a class="skip" href="#view">跳到正文</a>
    @if (ui.skin() === 'paper') {
      <header appPaperHeader></header>
    } @else {
      <header appAmberHeader></header>
    }
    <main id="view" tabindex="-1">
      <router-outlet />
    </main>
    @if (ui.skin() === 'paper') {
      <footer appPaperFooter></footer>
      <nav appPaperTabBar></nav>
    } @else {
      <footer appAmberFooter></footer>
      <nav appAmberTabBar></nav>
    }
    <app-toast-host />
    <app-dialog-host />
  `,
})
export class AppComponent {
  protected readonly ui = inject(UiStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => (document.body.dataset['route'] = routeName(e.urlAfterRedirects.split(/[?#]/)[0])));

    // 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
    effect(() => {
      if (this.auth.hydrated() && this.auth.refreshToken()) untracked(() => void this.auth.refreshMe());
    });

    // 登录态在受保护页面上丢了（refresh 失败等）：守卫不会再跑一遍，这里补一次跳转
    effect(() => {
      const lost = !this.auth.user() && !this.auth.refreshToken();
      untracked(() => {
        if (lost && this.needsAuth(this.router.routerState.snapshot.root)) {
          void this.router.navigateByUrl(loginPath(this.router.url), { replaceUrl: true });
        }
      });
    });
  }

  private needsAuth(r: ActivatedRouteSnapshot | null): boolean {
    for (; r; r = r.firstChild) if (r.data['auth']) return true;
    return false;
  }
}
