// ============================================================
// 长按火漆封缄：按住约 1.15 秒才提交，松手过早不算（X2：空格按住同样可用）。
// 完成由定时器驱动（后台标签页里 rAF 会停），rAF 只负责画进度环。
// 校验与提交交给 CreateFacade；公开方法 reset() 供「再写一枚」复位。
// ============================================================

import { ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, inject, signal, viewChild } from '@angular/core';
import { clamp } from '@/lib/fmt';
import { CreateFacade } from '@/pages/create/create.facade';
import { ShakeDirective } from '@/shared/shake.directive';
import { CONTENTS } from '@/shared/host';
import { PaperWaxComponent } from '../parts/wax.component';

const HOLD_MS = 1150;
const IDLE_HINT = '长按火漆，封缄';

@Component({
  selector: 'app-paper-hold-seal',
  imports: [ShakeDirective, PaperWaxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="hold-row">
      <button
        #btn
        class="hold"
        [class.is-holding]="state() === 'holding'"
        [class.is-done]="state() === 'done'"
        [appShake]="quick()"
        type="button"
        aria-describedby="holdHint"
        data-testid="create-submit"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="cancel()"
        (pointercancel)="cancel()"
        (lostpointercapture)="cancel()"
        (keydown)="onKeyDown($event)"
        (keyup)="onKeyUp($event)"
        (blur)="cancel()"
        (contextmenu)="$event.preventDefault()"
      >
        <svg class="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="hold__track" cx="60" cy="60" r="56" />
          <circle class="hold__prog" cx="60" cy="60" r="56" pathLength="100" />
        </svg>
        <span appPaperWax ch="封" class="hold__wax"></span>
        <span class="sr-only">长按封缄</span>
      </button>
      <div class="hold-copy">
        <b id="holdHint">{{ f.submitting() ? '正在封缄…' : hint() }}</b>
        <p>封缄后不可修改、不可提前开启；<br />可以在「我创建的」里删除。</p>
        <p class="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
      </div>
    </div>
  `,
})
export class PaperHoldSealComponent {
  protected readonly f = inject(CreateFacade);
  private readonly btn = viewChild.required<ElementRef<HTMLButtonElement>>('btn');
  protected readonly state = signal<'' | 'holding' | 'done'>('');
  protected readonly hint = signal(IDLE_HINT);
  protected readonly quick = signal(0);
  private holding = false;
  private raf = 0;
  private timer = 0;
  private t0 = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.timer);
    });
  }

  private setHp(v: number | string) {
    this.btn().nativeElement.style.setProperty('--hp', String(v));
  }

  private readonly frame = (t: number) => {
    if (!this.holding) return;
    this.setHp(clamp((t - this.t0) / HOLD_MS, 0, 1).toFixed(3));
    this.raf = requestAnimationFrame(this.frame);
  };

  private complete() {
    if (!this.holding) return;
    this.holding = false;
    cancelAnimationFrame(this.raf);
    this.setHp(1);
    this.state.set('done');
    void this.f.submit().then((c) => {
      if (!c) this.reset();
    });
  }

  private start() {
    if (this.holding || this.state() === 'done') return;
    if (!this.f.validate()) return;
    this.holding = true;
    this.t0 = performance.now();
    this.state.set('holding');
    this.hint.set('按住，别松手…');
    this.raf = requestAnimationFrame(this.frame);
    this.timer = window.setTimeout(() => this.complete(), HOLD_MS);
  }

  protected cancel() {
    if (!this.holding) return;
    const isQuick = performance.now() - this.t0 < 320;
    this.holding = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.state.set('');
    this.setHp(0);
    this.hint.set(isQuick ? '要按住约 1 秒才会封缄' : IDLE_HINT);
    if (isQuick) this.quick.update((n) => n + 1);
  }

  reset() {
    this.state.set('');
    this.hint.set(IDLE_HINT);
    this.setHp(0);
  }

  protected onPointerDown(e: PointerEvent) {
    if (e.button) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLButtonElement;
    el.focus({ preventScroll: true });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* 某些浏览器在合成事件里不允许捕获 */
    }
    this.start();
  }

  protected onKeyDown(e: KeyboardEvent) {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      this.start();
    }
  }

  protected onKeyUp(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') this.cancel();
  }
}
