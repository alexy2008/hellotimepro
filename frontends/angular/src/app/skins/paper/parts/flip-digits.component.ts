// 翻页数字：逐位翻动，只有变了的那一位会动——旧数字向上退出、新数字从下方进入
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { CONTENTS } from '@/shared/host';
import { KeyDirective } from '@/shared/key.directive';

@Component({
  selector: 'span[appPaperDigit]',
  imports: [KeyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dg', '[attr.data-v]': 'v()' },
  template: `
    @if (prev(); as p) {
      <span *appKey="p" class="dg__out">{{ p }}</span>
    }
    <span *appKey="v()" class="dg__cur" [class.dg__in]="prev() !== null">{{ v() }}</span>
  `,
})
export class PaperDigitComponent {
  readonly v = input.required<string>();
  protected readonly prev = signal<string | null>(null);
  private timer = 0;

  constructor() {
    let last: string | undefined;
    effect(() => {
      const v = this.v();
      untracked(() => {
        if (last !== undefined && last !== v) {
          this.prev.set(last);
          clearTimeout(this.timer);
          this.timer = window.setTimeout(() => this.prev.set(null), 520);
        }
        last = v;
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
}

@Component({
  selector: 'app-paper-flip-digits',
  imports: [PaperDigitComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@for (ch of chars(); track $index) {<span appPaperDigit [v]="ch"></span>}`,
})
export class PaperFlipDigitsComponent {
  readonly value = input.required<string>();
  protected readonly chars = computed(() => Array.from(this.value()));
}
