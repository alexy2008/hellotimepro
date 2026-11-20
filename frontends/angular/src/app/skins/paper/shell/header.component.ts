// ============================================================
// 「时笺」页头：品牌 · 主导航 · 写一枚 · 皮肤开关 · 明暗 · 账号
// 结构与类名照 2.0 原型 paper/shell.js；样式在 spec/styles/paper/components.css
// ============================================================

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { UiStore } from '@/stores/ui.store';
import { injectNavKey, themeOrigin } from '@/core/nav';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { SkinSwitchComponent } from '@/shared/skin-switch.component';
import { UserMenuComponent } from '@/shared/user-menu.component';
import { PaperBrandComponent } from './brand.component';

@Component({
  selector: 'header[appPaperHeader]',
  imports: [RouterLink, IconDirective, CreateLinkDirective, SkinSwitchComponent, UserMenuComponent, PaperBrandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hdr', '[class.is-scrolled]': 'scrolled()', '(window:scroll)': 'onScroll()' },
  template: `
    <div class="wrap hdr__in">
      <a appPaperBrand routerLink="/" aria-label="HelloTime Pro 首页"></a>
      <nav class="nav" aria-label="主导航">
        <a routerLink="/" data-testid="nav-plaza" [class.is-active]="cur() === 'plaza'" [attr.aria-current]="cur() === 'plaza' ? 'page' : null">广场</a>
        <a routerLink="/open" data-testid="nav-open" [class.is-active]="cur() === 'open'" [attr.aria-current]="cur() === 'open' ? 'page' : null">开启</a>
        <a routerLink="/about" data-testid="nav-about" [class.is-active]="cur() === 'about'" [attr.aria-current]="cur() === 'about' ? 'page' : null">关于</a>
      </nav>
      <div class="hdr__act">
        <a appCreateLink class="btn btn--ghost btn--sm hdr__write" data-testid="nav-create" [class.is-active]="cur() === 'create'" [attr.aria-current]="cur() === 'create' ? 'page' : null"
          ><svg appIcon="pen"></svg>写一枚</a
        >
        <div appSkinSwitch></div>
        <button
          class="iconbtn theme"
          type="button"
          data-testid="theme-toggle"
          [attr.aria-label]="ui.theme() === 'dark' ? '切换到日间主题' : '切换到夜间主题'"
          (click)="toggleTheme($event)"
        >
          <svg appIcon="sun" class="theme__sun"></svg>
          <svg appIcon="moon" class="theme__moon"></svg>
        </button>
        @if (auth.user()) {
          <app-user-menu createdIcon="mail" />
        } @else {
          <a class="btn btn--text hdr__login" routerLink="/login" data-testid="nav-login">登录</a>
          <a class="btn btn--primary btn--sm" routerLink="/register" data-testid="nav-register">注册</a>
        }
      </div>
    </div>
  `,
})
export class PaperHeaderComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly ui = inject(UiStore);
  protected readonly cur = injectNavKey();
  protected readonly scrolled = signal(window.scrollY > 6);

  protected onScroll() {
    this.scrolled.set(window.scrollY > 6);
  }

  protected toggleTheme(e: MouseEvent) {
    this.ui.toggleTheme(themeOrigin(e));
  }
}
