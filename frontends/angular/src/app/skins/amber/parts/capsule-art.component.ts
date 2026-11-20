// ============================================================
// 胶囊插画：全站反复出现的母题。左半是专属配色的舱盖，右半是能看见信纸的玻璃舱。
// locked 合拢上锁；opened 两半分开、信纸升起。切换形态只改 class，过渡由 CSS 完成。
// 颜色由胶囊码算出（lib/palette，docs/02-design.md §9.6）。用法：<svg appAmberCapsuleArt [code]="…" state="opened" [width]="150"></svg>
// ============================================================

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { paletteOf } from '@/lib/palette';
import { nextId } from './art';

@Component({
  selector: 'svg[appAmberCapsuleArt]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cart',
    viewBox: '0 0 240 120',
    'aria-hidden': 'true',
    '[class.cart--locked]': "state() === 'locked'",
    '[class.cart--opened]': "state() === 'opened'",
    '[attr.width]': 'width()',
    '[attr.height]': 'width() / 2',
    '[style.--cap-glow]': 'p().glow',
  },
  template: `
    <svg:defs>
      <svg:linearGradient [attr.id]="id + 'c'" x1="0" y1="0" x2="0" y2="1">
        <svg:stop offset="0" [attr.stop-color]="p().capLight" /><svg:stop offset="1" [attr.stop-color]="p().capDeep" />
      </svg:linearGradient>
      <svg:linearGradient [attr.id]="id + 'g'" x1="0" y1="0" x2="0" y2="1">
        <svg:stop offset="0" stop-color="#fff" stop-opacity=".62" /><svg:stop offset="1" [attr.stop-color]="p().accent" stop-opacity=".42" />
      </svg:linearGradient>
    </svg:defs>
    <svg:ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6" />
    <svg:g class="cart__paper">
      <svg:rect x="98" y="24" width="44" height="62" rx="5" />
      <svg:path d="M106 40h28M106 50h28M106 60h17" />
    </svg:g>
    <svg:g class="cart__cap">
      <svg:path d="M120 30H60a30 30 0 0 0 0 60h60Z" [attr.fill]="'url(#' + id + 'c)'" />
      <svg:path class="cart__groove" d="M104 31v58M111 31v58" />
      <svg:path class="cart__shine" d="M60 41h36" />
    </svg:g>
    <svg:g class="cart__body">
      <svg:path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" [attr.fill]="'url(#' + id + 'g)'" />
      <svg:rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6" />
      <svg:path class="cart__scroll-line" d="M141 56h30M141 64h19" />
      <svg:path class="cart__shine" d="M132 40h40" />
    </svg:g>
    <svg:rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5" />
    <svg:circle class="cart__lock" cx="120" cy="60" r="4.5" />
  `,
})
export class AmberCapsuleArtComponent {
  readonly code = input<string | null>(null);
  readonly state = input<'locked' | 'opened'>('locked');
  readonly width = input(200);
  protected readonly p = computed(() => paletteOf(this.code()));
  protected readonly id = nextId('ca');
}
