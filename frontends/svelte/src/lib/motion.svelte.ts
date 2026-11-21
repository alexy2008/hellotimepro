// ============================================================
// 「抖一下」：某个值变了（出错次数 +1、错误文案换了）就亮 480ms，视图据此加 is-shake。
// 须在组件初始化时调用（内部用 $effect，组件销毁时清理计时器）。
// ============================================================

export function useShake(source: () => unknown) {
  let on = $state(false);
  let first = true;
  let t = 0;
  $effect(() => {
    const v = source();
    if (first) return void (first = false);
    if (!v) return;
    on = true;
    clearTimeout(t);
    t = window.setTimeout(() => (on = false), 480);
  });
  $effect(() => () => clearTimeout(t));
  return {
    get on() {
      return on;
    },
  };
}
