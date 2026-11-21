// ============================================================
// 「琥珀」8 格输码：8 个展示格 + 一个盖在上面的透明原生输入框
// （键盘、粘贴、输入法都交给它）。size：'md' 首页 / 'lg' 开启页。
// ============================================================

import { Index, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { focusIfIdle } from "@/lib/fmt";
import { EMPTY_CODE_CELL, isCompleteCode, type CodeState } from "@/primitives/codeOpen";

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

interface Props {
  size?: "" | "md" | "lg";
  value: string;
  state: CodeState;
  shake: number;
  onChange?: (v: string) => void;
  onComplete: (v: string) => void;
  autoFocus?: boolean;
}

export function AmberCodeInput(props: Props) {
  const [focused, setFocused] = createSignal(false);
  const [shaking, setShaking] = createSignal(false);
  let input: HTMLInputElement | undefined;

  createEffect(
    on(
      () => props.shake,
      (n) => {
        if (!n) return;
        setShaking(true);
        const t = setTimeout(() => setShaking(false), 480);
        onCleanup(() => clearTimeout(t));
      },
      { defer: true },
    ),
  );

  onMount(() => {
    if (!props.autoFocus) return;
    const t = setTimeout(() => focusIfIdle(input), 350);
    onCleanup(() => clearTimeout(t));
  });

  // 本次新敲进来的格子「弹」一下：记住上一次的值，变长时从旧长度起的格子加 is-pop
  const grow = createMemo<{ v: string; from: number; grew: boolean }>(
    (prev) => ({ v: props.value, from: prev.v.length, grew: props.value.length > prev.v.length }),
    { v: props.value, from: props.value.length, grew: false },
  );

  const activeCell = () => {
    const gap = props.value.indexOf(EMPTY_CODE_CELL);
    return gap === -1 ? Math.min(props.value.length, 7) : gap;
  };

  const emit = (el: HTMLInputElement, raw: string) => {
    const v = raw.toUpperCase().replace(/[^A-Z0-9\u00a0]/g, "").slice(0, 8).trimEnd();
    // 受控输入：小写转大写、非法字符被丢掉时信号值可能没变，Solid 不会回写，这里手动对齐 DOM
    if (el.value !== v) el.value = v;
    props.onChange?.(v);
    if (isCompleteCode(v)) props.onComplete(v);
  };

  return (
    <div
      class={[
        "code",
        props.size ? `code--${props.size}` : "",
        focused() ? "is-focused" : "",
        props.state === "error" ? "is-error" : "",
        props.state === "checking" ? "is-checking" : "",
        props.state === "ok" ? "is-ok" : "",
        shaking() ? "is-shake" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        ref={input}
        class="code__native"
        type="text"
        inputMode="text"
        autocomplete="off"
        autoCapitalize="characters"
        spellcheck={false}
        maxLength={12}
        aria-label="8 位胶囊码"
        data-testid="code-input"
        value={props.value}
        onInput={(e) => {
          if (e.isComposing) return;
          // 一次进来一整串码（粘贴、自动填充）：与时笺一样整码从头填，不接在已经输入的几位后面
          const chunk = clean(e.data ?? "");
          emit(e.currentTarget, isCompleteCode(chunk) ? chunk : e.currentTarget.value);
        }}
        onPaste={(e) => {
          const pasted = clean(e.clipboardData?.getData("text") ?? "");
          if (!isCompleteCode(pasted)) return;
          e.preventDefault();
          emit(e.currentTarget, pasted);
        }}
        onCompositionEnd={(e) => emit(e.currentTarget, e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            props.onComplete(props.value);
          }
        }}
        onFocus={(e) => {
          setFocused(true);
          const value = e.currentTarget.value;
          const gap = value.indexOf(EMPTY_CODE_CELL);
          if (gap === -1) e.currentTarget.setSelectionRange(value.length, value.length);
          else e.currentTarget.setSelectionRange(gap, gap + 1);
        }}
        onBlur={() => setFocused(false)}
      />
      <div class="code__cells" aria-hidden="true">
        <Index each={Array.from({ length: 8 })}>
          {(_, i) => {
            const ch = () => {
              const char = props.value[i];
              return char === EMPTY_CODE_CELL ? "" : char ?? "";
            };
            return (
              <span
                class={[
                  "code__cell",
                  i === 4 ? "has-gap" : "",
                  ch() ? "is-filled" : "",
                  ch() && grow().grew && i >= grow().from ? "is-pop" : "",
                  i === activeCell() ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-code-cell=""
                data-value={ch()}
              >
                {ch()}
              </span>
            );
          }}
        </Index>
      </div>
    </div>
  );
}
