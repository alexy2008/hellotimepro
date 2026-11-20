// ============================================================
// 信封（封口面）：back 内衬 → letter 信纸 → front 口袋 → flap 封舌 → seal 火漆
// crack：火漆的状态。split 先换成左右两半，cracked 再让两半裂开（分两步，过渡才会生效）
// 信纸上写什么由投影内容决定。用法：<div appPaperEnvelope class="env--stage" [crack]="…">…</div>
// ============================================================

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PaperWaxComponent } from './wax.component';

@Component({
  selector: 'div[appPaperEnvelope]',
  imports: [PaperWaxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'env' },
  template: `
    <div class="env__back"></div>
    <div class="env__letter"><ng-content /></div>
    <div class="env__front">
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
        <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z" />
        <path class="env__shade" d="M1 2.2 50 38 99 2.2" />
        <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9" />
        <path class="env__edge" d="M0 0 50 36 100 0" />
      </svg>
    </div>
    <div class="env__flap">
      <i class="env__flap-f"><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 50 36 100 0" /></svg></i>
      <i class="env__flap-b"></i>
    </div>
    @if (seal()) {
      <div class="env__seal" [class.is-cracked]="crack() === 'cracked'">
        @if (crack() === 'whole') {
          <span appPaperWax></span>
        } @else {
          <span class="wax-half wax-half--l"><span appPaperWax></span></span>
          <span class="wax-half wax-half--r"><span appPaperWax></span></span>
        }
      </div>
    }
  `,
})
export class PaperEnvelopeComponent {
  readonly seal = input(true);
  readonly crack = input<'whole' | 'split' | 'cracked'>('whole');
}
