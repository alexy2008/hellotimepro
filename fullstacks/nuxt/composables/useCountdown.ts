// 倒计时 composable：每秒一次响应式的当前时间戳。
// 仅当 active 为 true 时启动 setInterval；卸载时自动清理。
//
// 用法：
//   const { now } = useCountdown(() => !capsule.isOpened);
//   const cd = computed(() => countdownTo(capsule.openAt, now.value));

import { onUnmounted, ref, watch, type Ref } from "vue";

export interface UseCountdownReturn {
  now: Ref<number>;
}

export function useCountdown(
  active: () => boolean,
): UseCountdownReturn {
  const now = ref(Date.now());
  let timer: number | undefined;

  function start() {
    if (timer !== undefined) return;
    timer = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }

  function stop() {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  watch(
    active,
    (on) => {
      if (on) start();
      else stop();
    },
    { immediate: true },
  );

  onUnmounted(stop);

  return { now };
}
