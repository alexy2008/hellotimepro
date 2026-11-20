// ============================================================
// 分段选择：一排按钮 + 一块跟着选中项滑动的底（.seg__thumb）。
// 泛型组件：[(value)] 的类型就是选项值的联合类型（PlazaSort / PlazaFilter）。
// 两套皮肤同一份标记，长相由 spec/styles 决定。
// ============================================================

import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { IconName } from '@/lib/icons';
import { IconDirective } from './icon.directive';
import { SliderThumbDirective } from './slider-thumb.directive';
import { CONTENTS } from './host';

export interface SegOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  count?: number | null;
}

@Component({
  selector: 'app-seg',
  imports: [IconDirective, SliderThumbDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="seg" role="group" [attr.aria-label]="label()">
      <span class="seg__thumb" appSliderThumb=".seg__opt.is-active" [sliderKey]="key()"></span>
      @for (o of options(); track o.value) {
        <button
          class="seg__opt"
          [class.is-active]="o.value === value()"
          type="button"
          [attr.aria-pressed]="o.value === value()"
          [attr.data-testid]="testid()"
          [attr.data-value]="o.value"
          [attr.data-selected]="o.value === value()"
          [attr.data-count]="o.count ?? null"
          (click)="pick(o.value)"
        >
          @if (o.icon) {<svg [appIcon]="o.icon"></svg>}{{ o.label }}@if (o.count != null) {<sup>{{ o.count }}</sup>}
        </button>
      }
    </div>
  `,
})
export class SegComponent<T extends string> {
  readonly value = model.required<T>();
  readonly label = input.required<string>();
  readonly options = input.required<SegOption<T>[]>();
  readonly testid = input.required<string>();

  /** 选中项变了、数量从无到有（按钮变宽）都要重新对齐滑块 */
  protected readonly key = computed(() => `${this.value()}|${this.options().map((o) => o.count ?? '').join(',')}`);

  protected pick(v: T) {
    if (v !== this.value()) this.value.set(v);
  }
}
