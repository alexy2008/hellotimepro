// ============================================================
// 「琥珀」我的（/me/created · /me/favorites · /me/profile）
// 页签是一枚大号分段控件，每一项是链接，滑块跟着当前页签
// 结构与类名照 2.0 原型 amber/view-account.js
// ============================================================

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { MeFacade } from '@/pages/me/me.facade';
import { injectNow } from '@/core/clock';
import type { IconName } from '@/lib/icons';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { SliderThumbDirective } from '@/shared/slider-thumb.directive';
import { KeyDirective } from '@/shared/key.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { AmberMeCreatedComponent } from './me-created.component';
import { AmberMeFavoritesComponent } from './me-favorites.component';
import { AmberMeProfileComponent } from './me-profile.component';

const STATS = [
  ['created', '写下的胶囊'],
  ['unopened', '还在封存中'],
  ['favoritesReceived', '被收藏的次数'],
] as const;

@Component({
  selector: 'app-amber-me',
  imports: [RouterLink, IconDirective, AvatarComponent, SliderThumbDirective, KeyDirective, FmtPipe, AmberMeCreatedComponent, AmberMeFavoritesComponent, AmberMeProfileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let u = auth.user()!;
    @let s = me.stats();
    <div class="page page--me">
      <div class="container me">
        <header class="me__head card">
          <div class="me__id">
            <div class="me__orb"><span appAvatar [avatar]="u.avatarId" class="av--hero"></span><span class="me__ring"></span></div>
            <div>
              <div class="eyebrow">My capsules</div>
              <h1 class="page-title">{{ u.nickname }}</h1>
              <p class="me__mail"><span class="mono">{{ u.email }}</span><span>{{ u.createdAt | fmt: 'cn' }} 加入</span></p>
            </div>
          </div>
          <dl class="me__stats">
            @for (st of stats; track st[0]) {
              <div data-testid="me-stat" [attr.data-key]="st[0]" [attr.data-value]="s ? s[st[0]] : ''">
                <dd class="mono">{{ s ? (s[st[0]] | fmt: 'num') : '—' }}</dd>
                <dt>{{ st[1] }}</dt>
              </div>
            }
          </dl>
        </header>

        <div class="me__bar">
          <nav class="seg seg--lg" aria-label="我的">
            <span class="seg__thumb" appSliderThumb=".seg__opt.is-active" [sliderKey]="thumbKey()"></span>
            @for (t of tabs(); track t.key) {
              <a
                class="seg__opt"
                [class.is-active]="me.tab() === t.key"
                [routerLink]="'/me/' + t.key"
                [attr.aria-current]="me.tab() === t.key ? 'page' : null"
                [attr.data-testid]="'me-tab-' + t.key"
                [attr.data-count]="t.n ?? null"
              ><svg [appIcon]="t.icon"></svg>{{ t.label }}@if (t.n != null) {<sup>{{ t.n }}</sup>}</a>
            }
          </nav>
          <button class="btn btn--ghost btn--sm" type="button" (click)="me.logout()"><svg appIcon="logout"></svg>登出</button>
        </div>

        <!-- 换页签时整块重建，is-swap 的入场动画才会重播 -->
        <div *appKey="me.tab()" class="me__body is-swap" [attr.data-tab]="me.tab()">
            @switch (me.tab()) {
              @case ('created') {
                <app-amber-me-created [now]="now()" />
              }
              @case ('favorites') {
                <app-amber-me-favorites [now]="now()" />
              }
              @default {
                <app-amber-me-profile />
              }
            }
        </div>
      </div>
    </div>
  `,
})
export class AmberMeComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly me = inject(MeFacade);
  protected readonly now = injectNow();
  protected readonly stats = STATS;
  protected readonly tabs = computed(() => {
    const s = this.me.stats();
    return [
      { key: 'created', icon: 'feather' as IconName, label: '我创建的', n: s?.created },
      { key: 'favorites', icon: 'heart' as IconName, label: '我收藏的', n: s?.favoritesGiven },
      { key: 'profile', icon: 'sliders' as IconName, label: '账号设置', n: undefined as number | undefined },
    ];
  });
  protected readonly thumbKey = computed(() => `${this.me.tab()}|${this.me.stats()?.created}|${this.me.stats()?.favoritesGiven}`);
}
