// 详情 · 未启封：信封 + 翻页倒计时 + 刻度尺。opening 不为空时信封在播启封动画
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleDetail } from '@/types';
import { fmt, ms, pad2 } from '@/lib/fmt';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperEnvelopeComponent } from '../parts/envelope.component';
import { PaperFlipDigitsComponent } from '../parts/flip-digits.component';
import { PaperPostmarkComponent } from '../parts/postmark.component';
import { PaperScaleComponent } from '../parts/scale.component';
import { PaperSealComponent } from '../parts/seal.component';
import type { Opening } from '../parts/art';
import { PaperDetailActionsComponent } from './detail-actions.component';

@Component({
  selector: 'app-paper-sealed',
  imports: [
    RouterLink,
    IconDirective,
    AvatarComponent,
    FmtPipe,
    PaperEnvelopeComponent,
    PaperFlipDigitsComponent,
    PaperPostmarkComponent,
    PaperScaleComponent,
    PaperSealComponent,
    PaperDetailActionsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let cap = c();
    <a class="back" routerLink="/"><svg appIcon="arrow-left"></svg>返回广场</a>
    <header class="detail__head">
      <div class="detail__meta">
        <span class="mono">NO. {{ cap.code }}</span>
        @if (cap.inPlaza) {
          <span class="tag"><svg appIcon="globe"></svg>广场公开</span>
        } @else {
          <span class="tag tag--quiet"><svg appIcon="lock"></svg>仅凭码可见</span>
        }
        <span class="tag tag--seal"><span appPaperSeal ch="封"></span>未开启</span>
      </div>
      <h1 class="detail__title" data-testid="detail-title">{{ cap.title }}</h1>
      <div class="detail__by">
        <span appAvatar [avatar]="cap.creator.avatarId"></span><b>{{ cap.creator.nickname }}</b><span>封存于 {{ createdAt() | fmt: 'cn' }} {{ createdAt() | fmt: 'time' }}</span>
      </div>
    </header>

    <section class="stage">
      <div class="stage__pm">
        <svg appPaperPostmark [line1]="openAt() | fmt: 'date'" [line2]="(openAt() | fmt: 'time') + ' 启'" class="pm--stage"></svg>
      </div>
      <div appPaperEnvelope class="env--stage" [class.is-open]="!!opening()?.open" [class.is-rising]="!!opening()?.rising" [crack]="opening()?.crack ?? 'whole'">
        <b>{{ cap.title }}</b><i></i><i></i><i></i><i></i>
      </div>
      <div class="stage__floor"></div>
    </section>

    <section class="cd" aria-live="off" role="timer" data-testid="countdown" [attr.data-open-at]="cap.openAt" [attr.aria-label]="cdLabel()">
      <div class="cd__label">{{ opening() ? '时间到了，正在启封…' : '距离启封还有' }}</div>
      <div class="cd__digits">
        @for (u of units(); track u.lab; let first = $first) {
          @if (!first) {
            <i class="cd__sep">:</i>
          }
          <div class="cd__unit">
            <span class="cd__num latin"><app-paper-flip-digits [value]="u.v" /></span>
            <span class="cd__lab">{{ u.lab }}</span>
          </div>
        }
      </div>
      <div class="cd__when">将于 <b>{{ openAt() | fmt: 'full' }}</b> 启封</div>
    </section>

    <section class="journey">
      <div class="journey__row">
        <span><em>封存</em>{{ createdAt() | fmt: 'date' }}</span>
        <span class="journey__pct">已等待 {{ progress() }}%</span>
        <span><em>启封</em>{{ openAt() | fmt: 'date' }}</span>
      </div>
      <div appPaperScale [p]="progress()" class="scale--lg"></div>
    </section>

    <div appPaperDetailActions [c]="cap"></div>
    <p class="note">
      <svg appIcon="info"></svg><span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span>
    </p>
  `,
})
export class PaperSealedComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly now = input.required<number>();
  readonly opening = input<Opening | null>(null);

  protected readonly openAt = computed(() => ms(this.c().openAt));
  protected readonly createdAt = computed(() => ms(this.c().createdAt));
  private readonly cd = computed(() => fmt.cd(this.openAt(), this.now()));
  protected readonly progress = computed(() => fmt.progress(this.createdAt(), this.openAt(), this.now()));
  protected readonly units = computed(() => {
    const c = this.cd();
    return [
      { v: c.d > 99 ? String(c.d) : pad2(c.d), lab: '天' },
      { v: pad2(c.h), lab: '时' },
      { v: pad2(c.m), lab: '分' },
      { v: pad2(c.s), lab: '秒' },
    ];
  });
  protected readonly cdLabel = computed(() => {
    const c = this.cd();
    return `距离启封还有 ${c.d} 天 ${c.h} 小时 ${c.m} 分 ${c.s} 秒`;
  });
}
