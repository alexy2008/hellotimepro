// 封存完成：胶囊合拢，8 位码牌逐个翻出
import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleDetail } from '@/types';
import { reducedMotion } from '@/lib/fmt';
import { paletteOf } from '@/lib/palette';
import { ShareService } from '@/shared/share.service';
import { IconDirective } from '@/shared/icon.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { AmberVisBadgeComponent } from '../parts/badge.component';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';

@Component({
  selector: 'section[appAmberSealed]',
  imports: [RouterLink, IconDirective, FmtPipe, AmberVisBadgeComponent, AmberCapsuleArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sealed card',
    '[class.is-in]': 'inn()',
    '[style.--glow]': 'glow()',
    'data-testid': 'sealed-receipt',
    '[attr.data-code]': 'c().code',
  },
  template: `
    @let cap = c();
    <div class="sealed__art"><svg appAmberCapsuleArt [code]="cap.code" [state]="inn() ? 'locked' : 'opened'" [width]="260"></svg></div>
    <div class="eyebrow eyebrow--center">Sealed</div>
    <h1 class="page-title">胶囊已封存</h1>
    <p class="page-lead">下面这串胶囊码是开启它的钥匙，{{ cap.inPlaza ? '它也会出现在胶囊广场上。' : '它不会出现在广场，把码交给谁，谁才能找到它。' }}</p>
    <div class="tiles mono" [attr.aria-label]="'胶囊码 ' + cap.code" data-testid="sealed-code">
      @for (ch of chars(); track $index; let i = $index) {
        <span class="tile" [class.has-gap]="i === 4" [style.--i]="i">{{ ch }}</span>
      }
    </div>
    <div class="sealed__act">
      <button class="btn btn--primary" type="button" data-testid="copy-code" (click)="share.copyCode(cap.code)"><svg appIcon="copy"></svg>复制胶囊码</button>
      <button class="btn btn--ghost" type="button" data-testid="copy-link" (click)="share.copyLink(cap.code)"><svg appIcon="link"></svg>复制开启链接</button>
    </div>
    <dl class="sealed__meta">
      <div><dt>标题</dt><dd>{{ cap.title }}</dd></div>
      <div><dt>开启时间</dt><dd class="mono">{{ openAt() | fmt: 'dashTime' }}</dd></div>
      <div><dt>沉睡时长</dt><dd>{{ openAt() - mountedAt | fmt: 'span' }}</dd></div>
      <div><dt>属性</dt><dd><span appAmberVisBadge [inPlaza]="cap.inPlaza"></span></dd></div>
    </dl>
    <div class="sealed__links">
      <a class="link-btn" [routerLink]="'/capsules/' + cap.code" data-testid="receipt-view">看看它的倒计时<svg appIcon="arrow"></svg></a>
      <button class="link-btn" type="button" data-testid="receipt-again" (click)="again.emit()">再写一枚<svg appIcon="plus"></svg></button>
      <a class="link-btn" routerLink="/me/created">我创建的<svg appIcon="feather"></svg></a>
    </div>
  `,
})
export class AmberSealedComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly again = output<void>();
  protected readonly share = inject(ShareService);
  protected readonly openAt = computed(() => new Date(this.c().openAt).getTime());
  protected readonly chars = computed(() => Array.from(this.c().code));
  protected readonly glow = computed(() => paletteOf(this.c().code).glow);
  protected readonly mountedAt = Date.now();
  protected readonly inn = signal(false);

  constructor() {
    afterNextRender(() => {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      requestAnimationFrame(() => requestAnimationFrame(() => this.inn.set(true)));
    });
  }
}
