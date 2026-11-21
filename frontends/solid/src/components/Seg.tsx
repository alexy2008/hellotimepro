// ============================================================
// 分段选择：一排按钮 + 一块跟着选中项滑动的底（.seg__thumb）。
// 两套皮肤同一份标记，长相由 spec/styles 决定。
// 「我的」页签（琥珀）与页签墨线（时笺）也用这里的 createSlider 量位置。
// ============================================================

import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, type JSX } from "solid-js";

export interface SegOption<T extends string> {
  value: T;
  label: JSX.Element;
  count?: number | null;
}

/**
 * 量出 box 里 selector 命中的那一项的位置，返回给滑块用的 style。
 * deps 变化时重新量（选中项、数字从无到有都会改变宽度）；首次定位不带过渡；字体晚到、窗口缩放时再量一次。
 */
export function createSlider(box: () => HTMLElement | undefined, selector: string, deps: () => unknown, hideWhenNone = false) {
  const [style, setStyle] = createSignal<JSX.CSSProperties>(hideWhenNone ? { opacity: 0 } : {});
  let placed = false;
  const place = (animate: boolean) => {
    const a = box()?.querySelector<HTMLElement>(selector);
    if (!a) {
      if (hideWhenNone) setStyle({ opacity: 0 });
      return;
    }
    setStyle({
      ...(hideWhenNone ? { opacity: 1 } : {}),
      width: `${a.offsetWidth}px`,
      transform: `translateX(${a.offsetLeft}px)`,
      ...(animate ? {} : { transition: "none" }),
    });
  };
  createEffect(
    on(deps, () => {
      place(placed);
      placed = true;
      void document.fonts?.ready.then(() => place(false));
    }),
  );
  const onResize = () => place(false);
  window.addEventListener("resize", onResize);
  onCleanup(() => window.removeEventListener("resize", onResize));
  return style;
}

export function Seg<T extends string>(props: {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  testId: string;
}) {
  let box: HTMLDivElement | undefined;
  // options 里有 JSX（图标），每读一次 props.options 就会新建一批节点：只读一次，列表与量位置共用
  const options = createMemo(() => props.options);
  const thumb = createSlider(
    () => box,
    ".seg__opt.is-active",
    () => [props.value, options().map((o) => o.count ?? "").join(",")],
  );
  return (
    <div class="seg" ref={box} role="group" aria-label={props.label}>
      <span class="seg__thumb" style={thumb()} />
      <For each={options()}>
        {(o) => (
          <button
            class={`seg__opt${o.value === props.value ? " is-active" : ""}`}
            type="button"
            aria-pressed={o.value === props.value}
            data-testid={props.testId}
            data-value={o.value}
            data-selected={String(o.value === props.value)}
            data-count={o.count ?? undefined}
            onClick={() => o.value !== props.value && props.onChange(o.value)}
          >
            {o.label}
            <Show when={o.count != null}>
              <sup>{o.count}</sup>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}
