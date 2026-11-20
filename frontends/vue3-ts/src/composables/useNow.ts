// ============================================================
// 每秒一跳的全局节拍：所有倒计时共用一个模块级 ref 和一个定时器，对齐到整秒，
// 这样同一页上的十几个倒计时会在同一刻一起跳，不会参差。
// 有人用时才走表：最后一个使用者的作用域销毁（onScopeDispose）时停表。
// ============================================================

import { onScopeDispose, readonly, ref, type Ref } from "vue";

const now = ref(Date.now());
let users = 0;
let timer = 0;

function loop() {
  timer = window.setTimeout(() => {
    now.value = Date.now();
    loop();
  }, 1000 - (Date.now() % 1000) + 4);
}

/** 当前时间（毫秒），每整秒更新一次 */
export function useNow(): Readonly<Ref<number>> {
  if (++users === 1) {
    now.value = Date.now();
    loop();
  }
  onScopeDispose(() => {
    if (--users === 0) clearTimeout(timer);
  });
  return readonly(now);
}
