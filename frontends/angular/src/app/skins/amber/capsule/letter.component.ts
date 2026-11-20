// 详情 · 已开启：信纸自上而下展开，邮戳「啪」地盖上（reveal 时）
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleDetail } from '@/types';
import { ms } from '@/lib/fmt';
import { paragraphs } from '@/pages/capsule/capsule.facade';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { AmberVisBadgeComponent } from '../parts/badge.component';
import { AmberStampComponent } from '../parts/stamp.component';
import { AmberDetailActionsComponent } from './detail-actions.component';

@Component({
  selector: 'app-amber-letter',
  imports: [RouterLink, IconDirective, AvatarComponent, FmtPipe, AmberVisBadgeComponent, AmberStampComponent, AmberDetailActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let cap = c();
    <a class="back" routerLink="/"><svg appIcon="arrow-left"></svg>返回广场</a>
    <div class="letter-page" [class.is-reveal]="reveal()">
      <article class="letter">
        <div class="letter__meta"><span class="mono">{{ cap.code }}</span><i></i><span appAmberVisBadge [inPlaza]="cap.inPlaza"></span></div>
        <h1 class="letter__title" data-testid="detail-title">{{ cap.title }}</h1>
        <div class="letter__from"><span appAvatar [avatar]="cap.creator.avatarId"></span>{{ cap.creator.nickname }} 写于 {{ createdAt() | fmt: 'cn' }}</div>
        <div class="letter__body" data-testid="detail-content">
          @for (lines of paras(); track $index; let i = $index) {
            <p [style.--i]="i">@for (line of lines; track $index; let k = $index) {@if (k) {<br />}{{ line }}}</p>
          }
        </div>
        <footer class="letter__foot">
          <div class="letter__span">
            <div><svg appIcon="hourglass"></svg>这封信在时间里沉睡了 <b>{{ openAt() - createdAt() | fmt: 'span' }}</b></div>
            <span class="mono">{{ createdAt() | fmt: 'dashTime' }} 封存 → {{ openAt() | fmt: 'dashTime' }} 开启</span>
          </div>
          <div class="letter__sign"><svg appAmberStamp [date]="openAt()"></svg><span>—— {{ cap.creator.nickname }}</span></div>
        </footer>
      </article>
      <div appAmberDetailActions [c]="cap" [letter]="true"></div>
      @if (!cap.inPlaza) {
        <p class="tip tip--quiet"><svg appIcon="lock"></svg><span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span></p>
      }
    </div>
  `,
})
export class AmberLetterComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly reveal = input(false);
  protected readonly openAt = computed(() => ms(this.c().openAt));
  protected readonly createdAt = computed(() => ms(this.c().createdAt));
  protected readonly paras = computed(() => paragraphs(this.c().content));
}
