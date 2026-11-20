// 详情 · 封存中：进度环 + 胶囊 + 翻牌倒计时 + 元信息
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleDetail } from '@/types';
import { ms } from '@/lib/fmt';
import { paletteOf } from '@/lib/palette';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { AmberBadgeComponent, AmberVisBadgeComponent } from '../parts/badge.component';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberCountdownComponent } from '../parts/countdown.component';
import { AmberDetailActionsComponent } from './detail-actions.component';

const RING_C = 2 * Math.PI * 150;

@Component({
  selector: 'app-amber-locked',
  imports: [RouterLink, IconDirective, AvatarComponent, FmtPipe, AmberBadgeComponent, AmberVisBadgeComponent, AmberCapsuleArtComponent, AmberCountdownComponent, AmberDetailActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let cap = c();
    <a class="back" routerLink="/"><svg appIcon="arrow-left"></svg>返回广场</a>
    <section class="vault card" [style.--glow]="glow()">
      <div class="vault__dial">
        <svg class="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
          <circle class="vault__track" cx="170" cy="170" r="150" />
          <circle class="vault__arc" cx="170" cy="170" r="150" [style.stroke-dasharray]="dash()" />
        </svg>
        <div class="vault__art"><svg appAmberCapsuleArt [code]="cap.code" state="locked" [width]="220"></svg></div>
        <div class="vault__pct"><b class="mono">{{ pctText() }}%</b><span>时间已经走过</span></div>
      </div>
      <div class="vault__info">
        <div class="badges">
          <span appAmberBadge kind="locked" icon="lock">封存中</span>
          <span appAmberVisBadge [inPlaza]="cap.inPlaza"></span>
        </div>
        <h1 class="vault__title" data-testid="detail-title">{{ cap.title }}</h1>
        <div class="vault__by"><span appAvatar [avatar]="cap.creator.avatarId"></span>来自 <b>{{ cap.creator.nickname }}</b> · 封存于 {{ createdAt() | fmt: 'cn' }}</div>
        <div class="vault__k">距离开启还有</div>
        <div data-testid="countdown" [attr.data-open-at]="cap.openAt"><div appAmberCountdown [openAt]="openAt()" [now]="now()"></div></div>
        <dl class="vault__meta">
          <div><dt><svg appIcon="calendar"></svg>开启时间</dt><dd class="mono">{{ openAt() | fmt: 'dashTime' }}</dd></div>
          <div><dt><svg appIcon="key"></svg>胶囊码</dt><dd class="mono">{{ cap.code }}</dd></div>
          <div><dt><svg appIcon="heart"></svg>在等它的人</dt><dd class="mono">{{ cap.favoriteCount | fmt: 'num' }}</dd></div>
        </dl>
        <p class="tip"><svg appIcon="sparkle"></svg><span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span></p>
        <div appAmberDetailActions [c]="cap"></div>
      </div>
    </section>
  `,
})
export class AmberLockedComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly now = input.required<number>();
  protected readonly openAt = computed(() => ms(this.c().openAt));
  protected readonly createdAt = computed(() => ms(this.c().createdAt));
  protected readonly glow = computed(() => paletteOf(this.c().code).glow);
  private readonly pct = computed(() => Math.min(100, Math.max(0, ((this.now() - this.createdAt()) / (this.openAt() - this.createdAt())) * 100)));
  protected readonly pctText = computed(() => this.pct().toFixed(2));
  protected readonly dash = computed(() => `${((RING_C * this.pct()) / 100).toFixed(1)} ${RING_C.toFixed(1)}`);
}
