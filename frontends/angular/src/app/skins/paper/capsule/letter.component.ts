// 详情 · 已启封：一页信笺，字迹逐段显影（reveal 时）
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleDetail } from '@/types';
import { ms } from '@/lib/fmt';
import { paragraphs } from '@/pages/capsule/capsule.facade';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperPostmarkComponent } from '../parts/postmark.component';
import { PaperSealComponent } from '../parts/seal.component';
import { PaperDetailActionsComponent } from './detail-actions.component';

@Component({
  selector: 'app-paper-letter',
  imports: [RouterLink, IconDirective, AvatarComponent, FmtPipe, PaperPostmarkComponent, PaperSealComponent, PaperDetailActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let cap = c();
    <a class="back" routerLink="/"><svg appIcon="arrow-left"></svg>返回广场</a>
    <article class="letter" [class.letter--reveal]="reveal()">
      <div class="letter__pm"><svg appPaperPostmark [line1]="openAt() | fmt: 'date'" line2="已 启 封" class="pm--letter"></svg></div>
      <div class="letter__meta">
        <span class="mono">NO. {{ cap.code }}</span>
        @if (cap.inPlaza) {
          <span class="tag"><svg appIcon="globe"></svg>广场公开</span>
        } @else {
          <span class="tag tag--quiet"><svg appIcon="lock"></svg>仅凭码可见</span>
        }
      </div>
      <h1 class="letter__title" data-testid="detail-title">{{ cap.title }}</h1>
      <dl class="letter__facts">
        <div><dt>封存</dt><dd class="mono">{{ createdAt() | fmt: 'dateTime' }}</dd></div>
        <div><dt>启封</dt><dd class="mono">{{ openAt() | fmt: 'dateTime' }}</dd></div>
        <div><dt>在途</dt><dd>{{ openAt() - createdAt() | fmt: 'span' }}</dd></div>
      </dl>
      <div class="letter__body" data-testid="detail-content">
        @for (lines of paras(); track $index; let i = $index) {
          <p [style.--i]="i">@for (line of lines; track $index; let k = $index) {@if (k) {<br />}{{ line }}}</p>
        }
      </div>
      <footer class="letter__sign">
        <div class="letter__from"><span>——</span><span appAvatar [avatar]="cap.creator.avatarId"></span><b>{{ cap.creator.nickname }}</b></div>
        <div class="letter__date">写于 {{ createdAt() | fmt: 'cn' }}</div>
        <span appPaperSeal ch="启" variant="line" class="letter__seal"></span>
      </footer>
    </article>
    <div appPaperDetailActions [c]="cap"></div>
    @if (cap.inPlaza) {
      <p class="note note--ok"><svg appIcon="check"></svg><span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span></p>
    } @else {
      <p class="note"><svg appIcon="lock"></svg><span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span></p>
    }
  `,
})
export class PaperLetterComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly reveal = input(false);
  protected readonly openAt = computed(() => ms(this.c().openAt));
  protected readonly createdAt = computed(() => ms(this.c().createdAt));
  protected readonly paras = computed(() => paragraphs(this.c().content));
}
