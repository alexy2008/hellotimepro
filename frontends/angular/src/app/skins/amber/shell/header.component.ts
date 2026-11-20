// ============================================================
// 「琥珀」悬浮胶囊顶栏：品牌 · 导航（高亮底跟着当前页滑动）· 皮肤开关 · 星夜 / 晨曦开关 · 账号
// 结构与类名照 2.0 原型 amber/shell.js；样式在 spec/styles/amber/components.css
// ============================================================

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { UiStore } from '@/stores/ui.store';
import { injectNavKey, themeOrigin } from '@/core/nav';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { SkinSwitchComponent } from '@/shared/skin-switch.component';
import { SliderThumbDirective } from '@/shared/slider-thumb.directive';
import { UserMenuComponent } from '@/shared/user-menu.component';
import { AmberLogoComponent } from '../parts/logo.component';

@Component({
  selector: 'header[appAmberHeader]',
  imports: [RouterLink, CreateLinkDirective, SkinSwitchComponent, SliderThumbDirective, UserMenuComponent, AmberLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hdr', '[class.is-scrolled]': 'scrolled()', '(window:scroll)': 'onScroll()' },
  template: `
    <div class="hdr__bar">
      <a class="brand" routerLink="/" aria-label="HelloTime Pro 首页">
        <svg appAmberLogo [size]="34" class="brand__logo"></svg><span class="brand__name">HelloTime<small>PRO</small></span>
      </a>
      <nav class="nav" aria-label="主导航">
        <span class="nav__ink" aria-hidden="true" appSliderThumb=".nav__link.is-active" [sliderKey]="inkKey()" [hideWhenNone]="true"></span>
        <a class="nav__link" routerLink="/" data-testid="nav-plaza" [class.is-active]="cur() === 'plaza'" [attr.aria-current]="cur() === 'plaza' ? 'page' : null">胶囊广场</a>
        <a appCreateLink class="nav__link" data-testid="nav-create" [class.is-active]="cur() === 'create'" [attr.aria-current]="cur() === 'create' ? 'page' : null">写一枚</a>
        <a class="nav__link" routerLink="/open" data-testid="nav-open" [class.is-active]="cur() === 'open'" [attr.aria-current]="cur() === 'open' ? 'page' : null">开启胶囊</a>
        <a class="nav__link" routerLink="/about" data-testid="nav-about" [class.is-active]="cur() === 'about'" [attr.aria-current]="cur() === 'about' ? 'page' : null">关于</a>
      </nav>
      <div class="hdr__tools">
        <div appSkinSwitch></div>
        <button
          class="theme-toggle"
          type="button"
          role="switch"
          data-testid="theme-toggle"
          [attr.aria-checked]="ui.theme() === 'light'"
          [attr.aria-label]="ui.theme() === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦'"
          (click)="toggleTheme($event)"
        >
          <span class="theme-toggle__stars"></span><span class="theme-toggle__cloud"></span><span class="theme-toggle__knob"></span>
        </button>
        @if (auth.user()) {
          <app-user-menu createdIcon="feather" />
        } @else {
          <a class="btn btn--ghost btn--sm hdr__login" routerLink="/login" data-testid="nav-login">登录</a>
          <a class="btn btn--primary btn--sm" routerLink="/register" data-testid="nav-register">注册</a>
        }
      </div>
    </div>
  `,
})
export class AmberHeaderComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly ui = inject(UiStore);
  protected readonly cur = injectNavKey();
  protected readonly scrolled = signal(window.scrollY > 6);
  /** 当前项变了、登录态变了（顶栏宽度会变）都要重新对齐高亮底 */
  protected readonly inkKey = computed(() => `${this.cur()}|${this.auth.user()?.id ?? ''}`);

  protected onScroll() {
    this.scrolled.set(window.scrollY > 6);
  }

  protected toggleTheme(e: MouseEvent) {
    this.ui.toggleTheme(themeOrigin(e));
  }
}
