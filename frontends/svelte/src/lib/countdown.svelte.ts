// 倒计时辅助：在组件里调用 createCountdown(() => !isOpened)，得到一个
// 每秒递增的 now 时间戳 rune 状态。组件销毁时自动清理。
//
// 用法（在 .svelte 组件中）：
//   const cd = createCountdown(() => !capsule.isOpened);
//   const left = $derived(countdownTo(capsule.openAt, cd.now));

export interface Countdown {
  readonly now: number;
}

export function createCountdown(active: () => boolean): Countdown {
  let now = $state(Date.now());
  let timer: number | undefined;

  function start() {
    if (timer !== undefined) return;
    timer = window.setInterval(() => {
      now = Date.now();
    }, 1000);
  }

  function stop() {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  $effect(() => {
    if (active()) {
      start();
    } else {
      stop();
    }
    return stop;
  });

  return {
    get now() {
      return now;
    },
  };
}
