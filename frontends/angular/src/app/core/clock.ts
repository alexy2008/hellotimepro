// ============================================================
// 每秒一跳的全局节拍：所有倒计时共用一个 signal 和一个定时器，对齐到整秒，
// 这样同一页上的十几个倒计时会在同一刻一起跳，不会参差。
// 有人用时才走表：injectNow() 记一次使用，调用方销毁（DestroyRef）时减一，没人用就停表。
// ============================================================

import { DestroyRef, inject, Injectable, type Signal, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly tick = signal(Date.now());
  private users = 0;
  private timer = 0;

  /** 在注入上下文里调用：登记一个使用者，返回只读的「此刻」 */
  use(destroyRef: DestroyRef): Signal<number> {
    if (++this.users === 1) {
      this.tick.set(Date.now());
      this.loop();
    }
    destroyRef.onDestroy(() => {
      if (--this.users === 0) clearTimeout(this.timer);
    });
    return this.tick.asReadonly();
  }

  private loop() {
    this.timer = window.setTimeout(() => {
      this.tick.set(Date.now());
      this.loop();
    }, 1000 - (Date.now() % 1000) + 4);
  }
}

/** 当前时间（毫秒），每整秒更新一次；只能在注入上下文里调用（字段初始化、构造函数） */
export function injectNow(): Signal<number> {
  return inject(Clock).use(inject(DestroyRef));
}
