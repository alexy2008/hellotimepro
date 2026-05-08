import { Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { ThemeToggleComponent } from '@/components/theme-toggle/theme-toggle.component';
import { avatarUrl } from '@/utils/avatar';

function shortName(name: string): string {
  return Array.from(name).slice(0, 4).join('');
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ThemeToggleComponent],
  template: `
    <header class="cy-header">
      <div class="cy-container cy-header__inner">
        <a routerLink="/" class="cy-brand">
          <img class="cy-brand__mark" src="/logo.svg" width="38" height="38" alt="" />
          HelloTime<span class="cy-brand__pro">PRO</span>
        </a>
        <nav class="cy-nav">
          <a routerLink="/" routerLinkActive="cy-nav__active" [routerLinkActiveOptions]="{ exact: true }">广场</a>
          <a routerLink="/open" routerLinkActive="cy-nav__active">开启</a>
          <a routerLink="/about" routerLinkActive="cy-nav__active">关于</a>
        </nav>
        <div class="cy-header__actions">
          <app-theme-toggle />
          @if (auth.user(); as user) {
            <div class="cy-user-menu" #menuRef>
              <button type="button" class="cy-user-chip cy-user-chip--button"
                aria-haspopup="menu" [attr.aria-expanded]="menuOpen()"
                [attr.aria-label]="user.nickname + ' 的菜单'"
                [title]="user.nickname"
                (click)="menuOpen.set(!menuOpen())">
                <span [title]="user.nickname">{{ shortName(user.nickname) }}</span>
                <img [src]="avatarUrl(user.avatarId)" alt="" />
                <span class="cy-user-chip__chevron" aria-hidden="true">⌄</span>
              </button>
              @if (menuOpen()) {
                <div class="cy-user-dropdown" role="menu">
                  <a routerLink="/me/created" role="menuitem" routerLinkActive="is-active"
                    class="cy-user-dropdown__item" (click)="menuOpen.set(false)">
                    <span aria-hidden="true">📝</span><span>我创建的</span>
                  </a>
                  <a routerLink="/me/favorites" role="menuitem" routerLinkActive="is-active"
                    class="cy-user-dropdown__item" (click)="menuOpen.set(false)">
                    <span aria-hidden="true">♥</span><span>我收藏的</span>
                  </a>
                  <a routerLink="/me/profile" role="menuitem" routerLinkActive="is-active"
                    class="cy-user-dropdown__item" (click)="menuOpen.set(false)">
                    <span aria-hidden="true">⚙</span><span>账号设置</span>
                  </a>
                  <span class="cy-user-dropdown__divider"></span>
                  <button type="button" role="menuitem"
                    class="cy-user-dropdown__item cy-user-dropdown__item--danger"
                    (click)="doLogout()">
                    <span aria-hidden="true">↩</span><span>登出</span>
                  </button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login" class="cy-btn cy-btn--ghost cy-btn--sm">登录</a>
            <a routerLink="/register" class="cy-btn cy-btn--primary cy-btn--sm">注册</a>
          }
        </div>
      </div>
    </header>
  `,
})
export class AppHeaderComponent {
  @ViewChild('menuRef') menuRef!: ElementRef<HTMLDivElement>;
  auth = inject(AuthStore);
  private router = inject(Router);
  menuOpen = signal(false);
  shortName = shortName;
  avatarUrl = avatarUrl;

  @HostListener('document:pointerdown', ['$event'])
  onPointerDown(e: PointerEvent) {
    if (this.menuOpen() && !this.menuRef?.nativeElement.contains(e.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.menuOpen.set(false);
  }

  async doLogout() {
    this.menuOpen.set(false);
    await this.auth.logout();
    window.location.assign('/');
  }
}
