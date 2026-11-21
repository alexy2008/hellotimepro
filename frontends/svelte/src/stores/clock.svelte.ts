// ============================================================
// 每秒一跳的全局节拍：所有倒计时共用一个定时器，对齐到整秒，
// 同一页上的十几个倒计时会在同一刻一起跳。
// 用 createSubscriber：有组件（或 effect）在读 clock.now 时才走表，最后一个读者离开就停表。
// ============================================================

import { createSubscriber } from "svelte/reactivity";

class Clock {
  #now = Date.now();
  #subscribe = createSubscriber((update) => {
    let timer = 0;
    const loop = () => {
      timer = window.setTimeout(() => {
        this.#now = Date.now();
        update();
        loop();
      }, 1000 - (Date.now() % 1000) + 4);
    };
    this.#now = Date.now();
    loop();
    return () => clearTimeout(timer);
  });

  /** 当前时间（毫秒），每整秒更新一次 */
  get now() {
    this.#subscribe();
    return this.#now;
  }
}

export const clock = new Clock();
