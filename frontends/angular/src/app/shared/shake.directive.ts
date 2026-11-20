// 抖一下：绑定的值变了（出错次数 +1、错误文案换了）且为真时，加 is-shake 480ms
import { DestroyRef, Directive, effect, inject, input, signal, untracked } from '@angular/core';

@Directive({
  selector: '[appShake]',
  host: { '[class.is-shake]': 'on()' },
})
export class ShakeDirective {
  readonly appShake = input<unknown>();
  protected readonly on = signal(false);
  private timer = 0;

  constructor() {
    let first = true;
    effect(() => {
      const v = this.appShake();
      if (first) return void (first = false); // 进来时已有的值不算
      if (!v) return;
      untracked(() => {
        this.on.set(true);
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.on.set(false), 480);
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
}
