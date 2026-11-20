// ============================================================
// 「琥珀」广场卡片：一枚专属配色的胶囊。用法：<article appAmberCard [c]="c" [now]="now()" [i]="i">
// 状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒当场翻面。
// ============================================================

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleListItem } from '@/types';
import { fmt, ms } from '@/lib/fmt';
import { paletteOf } from '@/lib/palette';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { FavButtonComponent } from '@/shared/fav-button.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { AmberBadgeComponent } from './badge.component';
import { AmberCapsuleArtComponent } from './capsule-art.component';
import { cdShort, preview } from './art';

@Component({
  selector: 'article[appAmberCard]',
  imports: [RouterLink, IconDirective, AvatarComponent, FavButtonComponent, FmtPipe, AmberBadgeComponent, AmberCapsuleArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pc',
    '[class.is-opened]': 'opened()',
    '[class.is-locked]': '!opened()',
    '[class.is-flipping]': 'flipping()',
    '[style.--glow]': 'glow()',
    '[style.--i]': 'i()',
    '[attr.data-testid]': 'testId()',
    '[attr.data-code]': 'c().code',
    '[attr.data-state]': "opened() ? 'opened' : 'sealed'",
    '[attr.data-in-plaza]': 'c().inPlaza',
  },
  template: `
    <a class="pc__link" [routerLink]="'/capsules/' + c().code" [attr.aria-label]="c().title + '，' + (opened() ? '已开启' : '封存中')" [attr.data-testid]="openTestId()"></a>
    <div class="pc__top">
      <div class="pc__art"><svg appAmberCapsuleArt [code]="c().code" [state]="opened() ? 'opened' : 'locked'" [width]="150"></svg></div>
      <div class="pc__badges">
        @if (opened()) {
          <span appAmberBadge kind="opened" icon="mail">已开启</span>
        } @else {
          <span appAmberBadge kind="locked" icon="lock">封存中</span>
        }
        @if (rank()) {
          <span appAmberBadge kind="hot" icon="fire">热度 No.{{ rank() }}</span>
        }
        @if (!c().inPlaza) {
          <span appAmberBadge kind="private" icon="lock">未公开</span>
        }
      </div>
    </div>
    <h3 class="pc__title" data-testid="card-title">{{ c().title }}</h3>
    <div class="pc__by">
      <span appAvatar [avatar]="c().creator.avatarId"></span><span class="pc__name">{{ c().creator.nickname }}</span>
      @if (mine()) {
        <em class="me-tag">我</em>
      }
      <i></i>封存于 {{ createdAt() | fmt: 'date' }}
    </div>
    <div class="pc__body">
      @if (opened()) {
        <p class="pc__excerpt">{{ excerpt() }}</p>
      } @else {
        <div class="pc__cd"><svg appIcon="hourglass"></svg><span class="pc__time mono">{{ cd() }}</span>后开启</div>
        <div class="pc__progress" title="从封存到开启，时间已经走过的比例"><span [style.width.%]="progress()"></span></div>
      }
    </div>
    <div class="pc__foot">
      <span class="pc__when"><svg appIcon="calendar"></svg>{{ openAt() | fmt: 'dateTime' }} {{ opened() ? '已开启' : '开启' }}</span>
      <app-fav-button [capsule]="c()" (changed)="favChange.emit($event.favorited)" />
    </div>
  `,
})
export class AmberCardComponent {
  readonly c = input.required<CapsuleListItem>();
  readonly now = input.required<number>();
  readonly i = input(0);
  readonly rank = input(0);
  readonly mine = input(false);
  /** 「我收藏的」里用 fav-item / row-open（spec/ui/testids.md §3.7） */
  readonly testId = input('capsule-card');
  readonly openTestId = input('card-open');
  readonly favChange = output<boolean>();

  protected readonly openAt = computed(() => ms(this.c().openAt));
  protected readonly createdAt = computed(() => ms(this.c().createdAt));
  protected readonly opened = computed(() => this.c().isOpened || this.openAt() <= this.now());
  /** 刚到点，等列表刷新回来之前先翻面 */
  protected readonly flipping = computed(() => !this.c().isOpened && this.openAt() <= this.now());
  protected readonly glow = computed(() => paletteOf(this.c().code).glow);
  protected readonly cd = computed(() => cdShort(this.openAt(), this.now()));
  protected readonly progress = computed(() => Math.max(2, fmt.progress(this.createdAt(), this.openAt(), this.now())));
  protected readonly excerpt = computed(() => preview(this.c().contentPreview));
}

@Component({
  selector: 'div[appAmberCardSkeleton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pc pc--skel', 'aria-hidden': 'true', '[style.--i]': 'i()' },
  template: `
    <i class="sk" style="width: 150px; height: 62px; border-radius: 999px"></i>
    <i class="sk" style="width: 70%; height: 22px; margin-top: 30px"></i>
    <i class="sk" style="width: 45%; height: 13px; margin-top: 12px"></i>
    <i class="sk" style="width: 100%; height: 13px; margin-top: 22px"></i>
    <i class="sk" style="width: 82%; height: 13px; margin-top: 10px"></i>
    <i class="sk" style="width: 100%; height: 13px; margin-top: 30px"></i>
  `,
})
export class AmberCardSkeletonComponent {
  readonly i = input(0);
}
