// ============================================================
// 每秒一跳的全局节拍：所有倒计时共用一个定时器，对齐到整秒，
// 这样同一页上的十几个倒计时会在同一刻一起跳，不会参差。
// 有人订阅时才走表；最后一个订阅者（组件）销毁时停表。
// ============================================================

import { createSignal, getOwner, onCleanup, type Accessor } from "solid-js";

const [now, setNow] = createSignal(Date.now());
let subs = 0;
let timer = 0;

function loop() {
  timer = window.setTimeout(() => {
    setNow(Date.now());
    loop();
  }, 1000 - (Date.now() % 1000) + 4);
}

/** 当前时间（毫秒），每整秒更新一次；在组件或 primitive 里调用，随其销毁自动退订 */
export function useNow(): Accessor<number> {
  if (!getOwner()) return now;
  if (subs++ === 0) {
    setNow(Date.now());
    loop();
  }
  onCleanup(() => {
    if (--subs === 0) clearTimeout(timer);
  });
  return now;
}
