// 刻度尺：封存 → 启封 的等待进度。用法：<div appPaperScale [p]="42" class="scale--lg"></div>
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'div[appPaperScale]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'scale', '[style.--p]': "p() + '%'" },
  template: `<i class="scale__fill"></i><i class="scale__mark"></i>`,
})
export class PaperScaleComponent {
  readonly p = input.required<number>();
}
