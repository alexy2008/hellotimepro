// 「琥珀」手机底栏（桌面宽度下由样式隐藏）
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { injectNavKey } from '@/core/nav';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { CreateLinkDirective } from '@/shared/create-link.directive';

@Component({
  selector: 'nav[appAmberTabBar]',
  imports: [RouterLink, IconDirective, AvatarComponent, CreateLinkDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabbar', 'aria-label': '主导航' },
  template: `
    <a routerLink="/" data-testid="tab-plaza" [class.is-active]="cur() === 'plaza'" [attr.aria-current]="cur() === 'plaza' ? 'page' : null"><svg appIcon="grid"></svg><span>广场</span></a>
    <a routerLink="/open" data-testid="tab-open" [class.is-active]="cur() === 'open'" [attr.aria-current]="cur() === 'open' ? 'page' : null"><svg appIcon="key"></svg><span>开启</span></a>
    <a appCreateLink class="tabbar__main" data-testid="tab-create" [class.is-active]="cur() === 'create'" [attr.aria-current]="cur() === 'create' ? 'page' : null"
      ><i><svg appIcon="pen"></svg></i><span>写一枚</span></a
    >
    <a [routerLink]="auth.user() ? '/me/created' : '/login'" data-testid="tab-me" [class.is-active]="cur() === 'me'" [attr.aria-current]="cur() === 'me' ? 'page' : null">
      @if (auth.user(); as u) {
        <span appAvatar [avatar]="u.avatarId"></span>
      } @else {
        <svg appIcon="user"></svg>
      }
      <span>{{ auth.user() ? '我的' : '登录' }}</span>
    </a>
  `,
})
export class AmberTabBarComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly cur = injectNavKey();
}
