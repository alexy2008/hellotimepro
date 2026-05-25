// Svelte action：监听元素外的 pointerdown 和 Escape，触发 handler。
// 用法：
//   <div use:clickOutside={() => menuOpen = false} />
//
// 仅在 active 为 true 时挂载监听（通过参数闭包传递）。

export interface ClickOutsideOptions {
  handler: () => void;
  active?: boolean;
}

export function clickOutside(node: HTMLElement, opts: ClickOutsideOptions) {
  let { handler, active = true } = opts;

  function onPointer(e: PointerEvent) {
    if (!active) return;
    if (!node.contains(e.target as Node)) handler();
  }
  function onKey(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === "Escape") handler();
  }

  document.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKey);

  return {
    update(next: ClickOutsideOptions) {
      handler = next.handler;
      active = next.active ?? true;
    },
    destroy() {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    },
  };
}
