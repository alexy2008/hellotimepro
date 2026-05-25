// 防抖辅助：把一个 getter 的变化以 delay 延迟反映到内部 debounced 值。
// 用法（在 .svelte 组件中）：
//   let draft = $state("");
//   const d = createDebounced(() => draft, 300);
//   $effect(() => { plaza.setQ(d.value); });

export interface Debounced<T> {
  readonly value: T;
}

export function createDebounced<T>(source: () => T, delay = 300): Debounced<T> {
  let value = $state(source()) as T;
  let timer: number | undefined;

  $effect(() => {
    const v = source();
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      value = v;
    }, delay);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  });

  return {
    get value() {
      return value;
    },
  };
}
