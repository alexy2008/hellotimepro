// ============================================================
// 「时笺」我的（/me/created · /me/favorites · /me/profile）
// 三个页签是同一条路由，参数变化时这个组件不重建，页头与统计不重绘
// 结构与类名照 2.0 原型 paper/view-account.js
// ============================================================

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { MeFacade } from '@/pages/me/me.facade';
import { injectNow } from '@/core/clock';
import { IconDirective } from '@/shared/icon.directive';
import { SliderThumbDirective } from '@/shared/slider-thumb.directive';
import { KeyDirective } from '@/shared/key.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperAvatarStampComponent } from '../parts/avatar-stamp.component';
import { PaperMeCreatedComponent } from './me-created.component';
import { PaperMeFavoritesComponent } from './me-favorites.component';
import { PaperMeProfileComponent } from './me-profile.component';

const STATS = [
  ['created', '写下的胶囊'],
  ['unopened', '还在等待启封'],
  ['favoritesReceived', '被收藏的次数'],
] as const;

@Component({
  selector: 'app-paper-me',
  imports: [RouterLink, IconDirective, SliderThumbDirective, KeyDirective, FmtPipe, PaperAvatarStampComponent, PaperMeCreatedComponent, PaperMeFavoritesComponent, PaperMeProfileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let u = auth.user()!;
    @let s = me.stats();
    <div class="page page--me">
      <div class="wrap me">
        <header class="me__head">
          <div class="me__id">
            <span appPaperAvatarStamp [avatar]="u.avatarId" class="stamp--lg"></span>
            <div>
              <div class="overline"><i></i>My desk</div>
              <h1 class="h1">{{ u.nickname }}</h1>
              <p class="me__mail"><span class="mono">{{ u.email }}</span><span>{{ u.createdAt | fmt: 'cn' }} 加入</span></p>
            </div>
          </div>
          <dl class="me__stats">
            @for (st of stats; track st[0]) {
              <div data-testid="me-stat" [attr.data-key]="st[0]" [attr.data-value]="s ? s[st[0]] : ''">
                <dd class="latin">{{ s ? (s[st[0]] | fmt: 'num') : '—' }}</dd>
                <dt>{{ st[1] }}</dt>
              </div>
            }
          </dl>
        </header>

        <nav class="tabs" aria-label="我的">
          @for (t of tabs(); track t.key) {
            <a
              class="tabs__it"
              [class.is-active]="me.tab() === t.key"
              [routerLink]="'/me/' + t.key"
              [attr.aria-current]="me.tab() === t.key ? 'page' : null"
              [attr.data-testid]="'me-tab-' + t.key"
              [attr.data-count]="t.n ?? null"
            >{{ t.label }}@if (t.n != null) {<sup>{{ t.n }}</sup>}</a>
          }
          <span class="tabs__ink" aria-hidden="true" appSliderThumb=".tabs__it.is-active" [sliderKey]="inkKey()"></span>
          <button class="linkbtn tabs__out" type="button" (click)="me.logout()"><svg appIcon="logout"></svg>登出</button>
        </nav>

        <!-- 换页签时整块重建，is-swap 的入场动画才会重播 -->
        <div *appKey="me.tab()" class="me__body is-swap" [attr.data-tab]="me.tab()">
            @switch (me.tab()) {
              @case ('created') {
                <app-paper-me-created [now]="now()" />
              }
              @case ('favorites') {
                <app-paper-me-favorites [now]="now()" />
              }
              @default {
                <app-paper-me-profile />
              }
            }
        </div>
      </div>
    </div>
  `,
})
export class PaperMeComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly me = inject(MeFacade);
  protected readonly now = injectNow();
  protected readonly stats = STATS;
  protected readonly tabs = computed(() => {
    const s = this.me.stats();
    return [
      { key: 'created', label: '我创建的', n: s?.created },
      { key: 'favorites', label: '我收藏的', n: s?.favoritesGiven },
      { key: 'profile', label: '账号设置', n: undefined as number | undefined },
    ];
  });
  protected readonly inkKey = computed(() => `${this.me.tab()}|${this.me.stats()?.created}|${this.me.stats()?.favoritesGiven}`);
}
