// 防抖 ref：source 改变 delay ms 后才把值反映到 debounced。
// 用法：
//   const draft = ref("");
//   const debounced = useDebouncedRef(draft, 300);
//   watch(debounced, (v) => plaza.setQ(v));

import { ref, watch, onUnmounted, type Ref } from "vue";

export function useDebouncedRef<T>(source: Ref<T>, delay = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;
  let timer: number | undefined;

  watch(source, (v) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      debounced.value = v;
    }, delay);
  });

  onUnmounted(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  });

  return debounced;
}
