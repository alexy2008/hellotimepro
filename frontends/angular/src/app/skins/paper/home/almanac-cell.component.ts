// 年鉴的一格：数字进入视口时数上来（年份从今年数到目标年）。用法：<div appPaperAlmanacCell k="all" [n]="…" a="…" b="…">
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CountUpDirective } from '@/shared/count-up.directive';

@Component({
  selector: 'div[appPaperAlmanacCell]',
  imports: [CountUpDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'almanac__cell', 'data-testid': 'stat', '[attr.data-key]': 'k()', '[attr.data-value]': 'n()' },
  template: `<b class="latin" [appCountUp]="n()" [countFrom]="plain() ? thisYear : 0" [countPlain]="plain()"></b><span>{{ a() }}<br />{{ b() }}</span>`,
})
export class PaperAlmanacCellComponent {
  readonly k = input.required<string>();
  readonly n = input.required<number>();
  readonly a = input.required<string>();
  readonly b = input.required<string>();
  readonly plain = input(false);
  protected readonly thisYear = new Date().getFullYear();
}
