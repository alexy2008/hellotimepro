// 监听容器外点击，触发 handler。仅在 active 为 true 时挂载监听。
// Esc 键也触发同一 handler（用于关闭菜单 / 弹层）。

import { onUnmounted, watch, type Ref } from "vue";

export function useClickOutside(
  target: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  handler: () => void,
) {
  function onPointer(e: PointerEvent) {
    const el = target.value;
    if (!el) return;
    if (!el.contains(e.target as Node)) handler();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") handler();
  }

  watch(
    active,
    (on) => {
      // 事件监听只在客户端有意义；SSR 无 document，且 immediate watcher 会在服务端 setup 时执行。
      if (!import.meta.client) return;
      if (on) {
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
      } else {
        document.removeEventListener("pointerdown", onPointer);
        document.removeEventListener("keydown", onKey);
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (!import.meta.client) return;
    document.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("keydown", onKey);
  });
}
