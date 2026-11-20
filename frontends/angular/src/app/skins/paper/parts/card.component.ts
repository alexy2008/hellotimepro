// ============================================================
// 「时笺」胶囊卡片：同一只信封的两种状态。用法：<article appPaperCard [c]="c" [now]="now()" [i]="i">
// 未开启 —— 合着、舌尖钤朱印，正文被模糊遮住，下面是等待进度的刻度尺
// 已开启 —— 封舌掀起、信纸露出半截，两行正文预览
// ============================================================

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleListItem } from '@/types';
import { fmt, ms } from '@/lib/fmt';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { FavButtonComponent } from '@/shared/fav-button.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { PaperCdShortComponent } from './cd-short.component';
import { PaperScaleComponent } from './scale.component';
import { PaperSealComponent } from './seal.component';
import { preview } from './art';

@Component({
  selector: 'article[appPaperCard]',
  imports: [RouterLink, IconDirective, AvatarComponent, FavButtonComponent, FmtPipe, PaperCdShortComponent, PaperScaleComponent, PaperSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cap',
    '[class.cap--opened]': 'opened()',
    '[class.cap--sealed]': '!opened()',
    '[style.--i]': 'i()',
    '[attr.data-testid]': 'testId()',
    '[attr.data-code]': 'c().code',
    '[attr.data-state]': "opened() ? 'opened' : 'sealed'",
    '[attr.data-in-plaza]': 'c().inPlaza',
  },
  template: `
    <div class="cap__bg" aria-hidden="true">
      @if (opened()) {
        <svg class="cap__art" viewBox="0 0 120 100" aria-hidden="true">
          <path class="ea__body" d="M2 42 60 4 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
          <rect class="ea__paper" x="16" y="14" width="88" height="62" rx="1.5" />
          <path class="ea__rule" d="M26 30h68M26 40h68M26 50h68M26 60h44" />
          <path class="ea__pocket" d="M2 42 60 78 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
          <path class="ea__line" d="M2.5 97.5 49 70M117.5 97.5 71 70" />
        </svg>
      } @else {
        <svg class="cap__art" viewBox="0 0 120 84" aria-hidden="true">
          <rect class="ea__body" x="2" y="6" width="116" height="76" rx="3" />
          <path class="ea__line" d="M2.5 80.5 47 46M117.5 80.5 73 46" />
          <path class="ea__flap" d="M3 7.5 60 48 117 7.5" />
          <g class="ea__seal">
            <circle cx="60" cy="48" r="11" />
            <circle class="ea__seal-ring" cx="60" cy="48" r="7" />
          </g>
        </svg>
      }
    </div>
    <a class="cap__link" [routerLink]="'/capsules/' + c().code" [attr.aria-label]="c().title + '，' + (opened() ? '已开启' : '未开启')" [attr.data-testid]="openTestId()"></a>
    <header class="cap__top">
      <span appPaperSeal [ch]="opened() ? '启' : '封'" [variant]="opened() ? 'line' : 'solid'"></span>
      <span class="cap__status">{{ opened() ? '已开启' : '未开启' }}</span>
      @if (!c().inPlaza) {
        <span class="cap__private" title="没有发布到广场，凭胶囊码可见"><svg appIcon="lock"></svg>未公开</span>
      }
      @if (rank()) {
        <span class="cap__rank latin" [title]="'热度第 ' + rank()">No.{{ rank() }}</span>
      }
      <span class="cap__code mono">{{ c().code }}</span>
    </header>
    <h3 class="cap__title" data-testid="card-title">{{ c().title }}</h3>
    @if (opened()) {
      <p class="cap__preview">{{ excerpt() }}</p>
      <div class="cap__when">
        <span>启于 {{ openAt() | fmt: 'date' }}</span><i></i><span>在途 {{ openAt() - createdAt() | fmt: 'span' }}</span>
      </div>
    } @else {
      <div class="cap__veil" aria-hidden="true"><i></i><i></i></div>
      <div class="cap__cd">
        <span class="cap__cd-label">距启封</span>
        <span class="cap__cd-val"><app-paper-cd-short [openAt]="openAt()" [now]="now()" /></span>
      </div>
      <div appPaperScale [p]="progress()"></div>
      <div class="cap__ends mono">
        <span>{{ createdAt() | fmt: 'date' }}</span><span>{{ openAt() | fmt: 'date' }}</span>
      </div>
    }
    <footer class="cap__foot">
      <span class="who">
        <span appAvatar [avatar]="c().creator.avatarId"></span><span class="who__n">{{ c().creator.nickname }}</span>
        @if (mine()) {
          <em class="who__me">我</em>
        }
      </span>
      <app-fav-button [capsule]="c()" (changed)="favChange.emit($event.favorited)" />
    </footer>
  `,
})
export class PaperCardComponent {
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
  protected readonly progress = computed(() => fmt.progress(this.createdAt(), this.openAt(), this.now()));
  protected readonly excerpt = computed(() => preview(this.c().contentPreview));
}

@Component({
  selector: 'div[appPaperCardSkeleton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cap cap--skel', 'aria-hidden': 'true', '[style.--i]': 'i()' },
  template: `<i class="sk sk--a"></i><i class="sk sk--b"></i><i class="sk sk--c"></i><i class="sk sk--c2"></i><i class="sk sk--d"></i>`,
})
export class PaperCardSkeletonComponent {
  readonly i = input(0);
}
