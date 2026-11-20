// ============================================================
// 封缄仪式 → 取信凭证：信纸落进信封 → 封舌合上 → 火漆落下 → 凭证滑出。
// 整层盖在页面之上，用 appPortal 挂到 body 下。
// ============================================================

import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, type ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleDetail } from '@/types';
import { reducedMotion, sleep } from '@/lib/fmt';
import { ShareService } from '@/shared/share.service';
import { IconDirective } from '@/shared/icon.directive';
import { PortalDirective } from '@/shared/portal.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { PaperEnvelopeComponent } from '../parts/envelope.component';

@Component({
  selector: 'div[appPaperCeremony]',
  imports: [RouterLink, IconDirective, FmtPipe, PaperEnvelopeComponent],
  hostDirectives: [PortalDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'cer ' + cls()",
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '封缄完成',
    'data-testid': 'sealed-receipt',
    '[attr.data-code]': 'c().code',
  },
  template: `
    @let cap = c();
    <div class="cer__bg"></div>
    <div class="cer__in">
      <div class="cer__stage">
        <div appPaperEnvelope [class]="'env--cer ' + env()"><b>{{ cap.title }}</b><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="rcpt">
        <div class="rcpt__k"><span>封缄完成</span><i></i><span class="latin">Sealed</span></div>
        <h2 class="rcpt__t serif">《{{ cap.title }}》</h2>
        <p class="rcpt__w">将于 <b>{{ openAt() | fmt: 'full' }}</b> 启封<br />还要等 {{ openAt() - mountedAt | fmt: 'span' }}</p>
        <div class="rcpt__code mono" [attr.aria-label]="'胶囊码 ' + cap.code" data-testid="sealed-code">
          @for (ch of chars(); track $index; let i = $index) {
            <span [style.--i]="i">{{ ch }}</span>
            @if (i === 3) {
              <i></i>
            }
          }
        </div>
        <p class="rcpt__hint">
          这 8 位胶囊码是开启它的凭证。{{ cap.inPlaza ? '它也会出现在胶囊广场上。' : '它不会出现在广场，把码交给谁，谁才能找到它。' }}
        </p>
        <div class="rcpt__act">
          <button #first class="btn btn--primary" type="button" data-testid="copy-code" (click)="share.copyCode(cap.code)"><svg appIcon="copy"></svg>复制胶囊码</button>
          <button class="btn btn--ghost" type="button" data-testid="copy-link" (click)="share.copyLink(cap.code)"><svg appIcon="link"></svg>复制分享链接</button>
        </div>
        <div class="rcpt__more">
          <a [routerLink]="'/capsules/' + cap.code" data-testid="receipt-view">查看这枚胶囊<svg appIcon="arrow"></svg></a>
          <button class="linkbtn" type="button" data-testid="receipt-again" (click)="again.emit()"><svg appIcon="pen"></svg>再写一枚</button>
        </div>
      </div>
    </div>
  `,
})
export class PaperCeremonyComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly again = output<void>();
  protected readonly share = inject(ShareService);
  protected readonly openAt = computed(() => new Date(this.c().openAt).getTime());
  protected readonly chars = computed(() => Array.from(this.c().code));
  protected readonly mountedAt = Date.now();
  protected readonly cls = signal('');
  protected readonly env = signal('is-open is-rising');
  private readonly first = viewChild.required<ElementRef<HTMLButtonElement>>('first');

  constructor() {
    let alive = true;
    inject(DestroyRef).onDestroy(() => (alive = false));
    afterNextRender(async () => {
      const q = reducedMotion();
      await sleep(30);
      if (!alive) return;
      this.cls.set('is-in');
      await sleep(q ? 0 : 520);
      this.env.set('is-open'); // 信纸落进信封
      await sleep(q ? 0 : 760);
      this.env.set(''); // 封舌合上
      await sleep(q ? 0 : 780);
      this.cls.set('is-in is-stamped'); // 火漆落下
      await sleep(q ? 0 : 720);
      if (!alive) return;
      this.cls.set('is-in is-stamped is-done'); // 凭证滑出
      this.first().nativeElement.focus({ preventScroll: true });
    });
  }
}
