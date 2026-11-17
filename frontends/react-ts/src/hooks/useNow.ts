// ============================================================
// 每秒一跳的全局节拍：所有倒计时共用一个定时器，对齐到整秒，
// 这样同一页上的十几个倒计时会在同一刻一起跳，不会参差。
// ============================================================

import { useSyncExternalStore } from "react";

const subs = new Set<() => void>();
let now = Date.now();
let timer = 0;

function loop() {
  timer = window.setTimeout(() => {
    now = Date.now();
    subs.forEach((fn) => fn());
    loop();
  }, 1000 - (Date.now() % 1000) + 4);
}

function subscribe(fn: () => void) {
  subs.add(fn);
  if (subs.size === 1) {
    now = Date.now();
    loop();
  }
  return () => {
    subs.delete(fn);
    if (!subs.size) clearTimeout(timer);
  };
}

/** 当前时间（毫秒），每整秒更新一次 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now);
}
