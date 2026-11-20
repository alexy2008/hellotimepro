// 年鉴数字：进入视口时从 from 数到 to（减少动效时直接显示终值）。指令自己写宿主的文字
import { DestroyRef, Directive, effect, ElementRef, inject, input, untracked } from '@angular/core';
import { fmt, reducedMotion } from '@/lib/fmt';

@Directive({ selector: '[appCountUp]' })
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  readonly countFrom = input(0);
  /** 年份之类：不加千分位 */
  readonly countPlain = input(false);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private io: IntersectionObserver | null = null;
  private raf = 0;

  constructor() {
    effect(() => {
      const to = this.appCountUp();
      const from = this.countFrom();
      untracked(() => this.run(to, from));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private show(v: number) {
    this.el.textContent = this.countPlain() ? String(v) : fmt.num(v);
  }

  private stop() {
    this.io?.disconnect();
    this.io = null;
    cancelAnimationFrame(this.raf);
  }

  private run(to: number, from: number) {
    this.stop();
    if (reducedMotion() || !('IntersectionObserver' in window)) return this.show(to);
    this.show(from);
    this.io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.io?.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 900);
          this.show(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
          if (k < 1) this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    this.io.observe(this.el);
  }
}
