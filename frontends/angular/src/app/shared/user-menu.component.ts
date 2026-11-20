// 已登录时页头右侧的头像菜单。createdIcon：两套皮肤给「我创建的」配的图标不同
import { ChangeDetectionStrategy, Component, type ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthStore } from '@/stores/auth.store';
import { FeedbackStore } from '@/stores/feedback.store';
import type { IconName } from '@/lib/icons';
import { AvatarComponent } from './avatar.component';
import { IconDirective } from './icon.directive';
import { CONTENTS } from './host';

@Component({
  selector: 'app-user-menu',
  imports: [RouterLink, AvatarComponent, IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ...CONTENTS, '(document:click)': 'onDoc($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @if (auth.user(); as u) {
      <div #box class="umenu" [class.is-open]="open()">
        <button
          class="uchip"
          type="button"
          aria-haspopup="menu"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="u.nickname + ' 的菜单'"
          data-testid="user-menu"
          [attr.data-nickname]="u.nickname"
          (click)="open.set(!open())"
        >
          <span appAvatar [avatar]="u.avatarId"></span><span class="uchip__n">{{ u.nickname }}</span><svg appIcon="chev-down" class="ic--chev"></svg>
        </button>
        <div class="umenu__pop" role="menu">
          <div class="umenu__who">
            <span appAvatar [avatar]="u.avatarId" class="av--lg"></span>
            <div><b>{{ u.nickname }}</b><span class="mono">{{ u.email }}</span></div>
          </div>
          <a role="menuitem" routerLink="/me/created" data-testid="menu-created"><svg [appIcon]="createdIcon()"></svg>我创建的</a>
          <a role="menuitem" routerLink="/me/favorites" data-testid="menu-favorites"><svg appIcon="heart"></svg>我收藏的</a>
          <a role="menuitem" routerLink="/me/profile" data-testid="menu-profile"><svg appIcon="sliders"></svg>账号设置</a>
          <hr />
          <button role="menuitem" type="button" data-testid="logout" (click)="logout()"><svg appIcon="logout"></svg>登出</button>
        </div>
      </div>
    }
  `,
})
export class UserMenuComponent {
  readonly createdIcon = input.required<IconName>();
  protected readonly auth = inject(AuthStore);
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    // 换页就收起
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.open.set(false));
  }

  protected onDoc(e: MouseEvent) {
    if (this.open() && !this.box()?.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected async logout() {
    this.open.set(false);
    await this.auth.logout(true);
    this.feedback.toast('已登出');
    await this.router.navigateByUrl('/');
  }
}
