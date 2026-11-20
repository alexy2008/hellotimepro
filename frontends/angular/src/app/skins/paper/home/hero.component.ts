// 「时笺」首页主视觉：标题 · 两个入口 · 就地输码 · 此刻；右侧一叠信、信封、邮戳与精选纸条（鼠标视差）
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleListItem } from '@/types';
import { ms, reducedMotion } from '@/lib/fmt';
import { scrollToPlaza } from '@/pages/home/home.facade';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { PaperCdShortComponent } from '../parts/cd-short.component';
import { PaperEnvelopeComponent } from '../parts/envelope.component';
import { PaperPostmarkComponent } from '../parts/postmark.component';
import { PaperSealComponent } from '../parts/seal.component';
import { PaperQuickOpenComponent } from './quick-open.component';

@Component({
  selector: 'section[appPaperHero]',
  imports: [
    RouterLink,
    IconDirective,
    CreateLinkDirective,
    FmtPipe,
    PaperCdShortComponent,
    PaperEnvelopeComponent,
    PaperPostmarkComponent,
    PaperSealComponent,
    PaperQuickOpenComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hero', '(pointermove)': 'onMove($event)', '(pointerleave)': 'onLeave()' },
  template: `
    <div class="wrap hero__in">
      <div class="hero__copy">
        <div class="overline"><i></i>HelloTime Pro · 时间胶囊</div>
        <h1 class="hero__title">
          <span class="hero__line"><span class="hero__clip"><span>把此刻，</span></span></span>
          <span class="hero__line"
            ><span class="hero__clip"><span>寄给<em class="hero__future" data-text="未来">未来</em></span></span
            ><span appPaperSeal ch="封" class="hero__dot"></span
          ></span>
        </h1>
        <p class="hero__lede">写下一段话，再选一个启封的时刻。<br />在那之前，谁也打不开它——包括你自己。</p>
        <div class="hero__cta">
          <a appCreateLink class="btn btn--primary btn--lg" data-testid="home-create"
            ><svg appIcon="pen"></svg><span>写一枚胶囊</span><svg appIcon="arrow" class="ic--go"></svg
          ></a>
          <a class="btn btn--ghost btn--lg" href="#plaza" (click)="toPlaza($event)"><span>逛逛胶囊广场</span><svg appIcon="arrow" class="ic--go"></svg></a>
        </div>
        <form appPaperQuickOpen></form>
        <div class="hero__now" aria-live="off">
          <span class="hero__now-k">此刻</span><span>{{ now() | fmt: 'cn' }} {{ now() | fmt: 'week' }}</span
          ><span class="mono hero__now-t">{{ now() | fmt: 'timeSec' }}</span><span class="hero__lunar">{{ now() | fmt: 'lunar' }}</span>
        </div>
      </div>
      <div #art class="hero__art">
        <div class="ha ha--letter" [style.--depth]="0.45" aria-hidden="true">
          <div class="ha-letter">
            <div class="ha-letter__to">致 未来 ——</div>
            <p>见字如面。</p>
            <p>写这封信的时候，窗外正在下雨。我不知道你打开它的那天，会是什么天气。</p>
            <p>但我想，你一定还记得……</p>
          </div>
        </div>
        <div class="ha ha--env" [style.--depth]="0.9" aria-hidden="true"><div appPaperEnvelope class="env--hero"></div></div>
        <div class="ha ha--pm" [style.--depth]="1.2" aria-hidden="true">
          <svg appPaperPostmark [line1]="now() | fmt: 'date'" line2="此 刻" class="pm--hero"></svg>
        </div>
        @if (featured(); as f) {
          <a class="ha ha--slip" [style.--depth]="1.5" [routerLink]="'/capsules/' + f.code" [attr.aria-label]="'广场上最受期待的胶囊：' + f.title">
            <div class="slip">
              <div class="slip__k"><span class="pulse-dot"></span>广场上最受期待的一枚</div>
              <div class="slip__t">{{ f.title }}</div>
              <div class="slip__cd"><app-paper-cd-short [openAt]="msOf(f.openAt)" [now]="now()" /></div>
              <div class="slip__f mono">
                <span>{{ f.code }}</span><span class="slip__fav"><svg appIcon="heart"></svg>{{ f.favoriteCount | fmt: 'num' }}</span>
              </div>
            </div>
          </a>
        }
      </div>
    </div>
    <div class="hero__side" aria-hidden="true"><span>见字如面</span><i></i><span class="latin">Est. 2026</span></div>
  `,
})
export class PaperHeroComponent {
  readonly now = input.required<number>();
  readonly featured = input.required<CapsuleListItem | null>();
  private readonly art = viewChild.required<ElementRef<HTMLElement>>('art');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly msOf = ms;
  protected readonly toPlaza = scrollToPlaza;

  protected onMove(e: PointerEvent) {
    if (e.pointerType === 'touch' || reducedMotion()) return;
    const r = this.host.nativeElement.getBoundingClientRect();
    const s = this.art().nativeElement.style;
    s.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    s.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }

  protected onLeave() {
    const s = this.art().nativeElement.style;
    s.setProperty('--mx', '0');
    s.setProperty('--my', '0');
  }
}
