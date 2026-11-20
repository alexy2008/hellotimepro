// 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」）。
// 用法：<span appPaperSeal ch="封" variant="line" class="hero__dot"></span>
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'span[appPaperSeal]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'seal', 'aria-hidden': 'true', '[class.seal--solid]': "variant() === 'solid'", '[class.seal--line]': "variant() === 'line'" },
  template: `{{ ch() }}`,
})
export class PaperSealComponent {
  readonly ch = input.required<string>();
  readonly variant = input<'solid' | 'line'>('solid');
}
