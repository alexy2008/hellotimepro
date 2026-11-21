// ============================================================
// 「时笺」8 格输码：8 个真实输入框（四四分组）。
// 粘贴、自动填充或一次填入整码（测试里的 fill）都会分发到各格。
// size：'' 为开启页的大号，'sm' 为首页的小号。
// ============================================================

import { Index, Show, createEffect, createSignal, on, onCleanup, onMount, untrack } from "solid-js";
import { focusIfIdle } from "@/lib/fmt";
import type { CodeState } from "@/primitives/codeOpen";

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export interface CodeInputHandle {
  set: (v: string) => void;
}

interface Props {
  size?: "" | "sm";
  value: string;
  state: CodeState;
  shake: number;
  onChange?: (v: string) => void;
  onComplete: (v: string) => void;
  autoFocus?: boolean;
  /** 外部写入整码（粘贴识别用）：组件把句柄交给这个回调 */
  handle?: (h: CodeInputHandle) => void;
  id?: string;
}

export function PaperCodeInput(props: Props) {
  // 各格自己的内容：从路由里已填的码起步（切皮肤后接着填），之后由这里分发
  const [cells, setCells] = createSignal<string[]>(untrack(() => Array.from({ length: 8 }, (_, i) => props.value[i] ?? "")));
  const refs: HTMLInputElement[] = [];
  const [shaking, setShaking] = createSignal(false);

  // 出错次数变了就抖一下，并把焦点放回最后一格（跳过挂载那一次）
  createEffect(
    on(
      () => props.shake,
      (n) => {
        if (!n) return;
        setShaking(true);
        const t = setTimeout(() => setShaking(false), 480);
        refs[7]?.focus();
        onCleanup(() => clearTimeout(t));
      },
      { defer: true },
    ),
  );

  onMount(() => {
    if (!props.autoFocus) return;
    const t = setTimeout(() => focusIfIdle(refs[0]), 350);
    onCleanup(() => clearTimeout(t));
  });

  const commit = (next: string[], focusAt: number, completeNow: boolean) => {
    setCells(next);
    // 受控输入：信号值没变（比如敲了非法字符被丢掉）时 Solid 不会回写 DOM，这里手动对齐
    next.forEach((ch, k) => refs[k] && refs[k].value !== ch && (refs[k].value = ch));
    const v = next.join("");
    props.onChange?.(v);
    refs[Math.min(7, focusAt)]?.focus();
    if (completeNow && v.length === 8) props.onComplete(v);
  };

  props.handle?.({
    set: (v: string) => {
      const s = clean(v).slice(0, 8);
      commit(Array.from({ length: 8 }, (_, k) => s[k] ?? ""), s.length, true);
    },
  });

  /** 从第 from 格开始填入一串字符 */
  const fill = (str: string, from: number) => {
    const s = clean(str).slice(0, 8 - from);
    const next = [...cells()];
    Array.from(s).forEach((ch, k) => (next[from + k] = ch));
    commit(next, from + s.length, true);
  };

  return (
    <div
      id={props.id}
      class={[
        "code",
        props.size ? `code--${props.size}` : "",
        props.state === "error" ? "is-error" : "",
        props.state === "checking" ? "is-checking" : "",
        props.state === "ok" ? "is-ok" : "",
        shaking() ? "is-shake" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="8 位胶囊码"
    >
      <Index each={cells()}>
        {(ch, i) => (
          <>
            <Show when={i === 4}>
              <span class="code__dash" aria-hidden="true" />
            </Show>
            <input
              ref={(el) => (refs[i] = el)}
              class={`code__cell mono${ch() ? " is-filled" : ""}`}
              type="text"
              inputMode="text"
              maxLength={i === 0 ? 8 : 1}
              autocomplete="off"
              autoCapitalize="characters"
              spellcheck={false}
              aria-label={`第 ${i + 1} 位`}
              style={{ "--k": i }}
              value={ch()}
              data-testid={i === 0 ? "code-input" : undefined}
              data-code-cell=""
              data-value={ch()}
              onFocus={(e) => e.currentTarget.select()}
              onInput={(e) => {
                const v = clean(e.currentTarget.value);
                // 一次进来不止一个字符：当作从这一格开始粘贴（整码则从头填）
                if (v.length > 1) return fill(v, v.length >= 8 ? 0 : i);
                const next = [...cells()];
                next[i] = v;
                commit(next, v && i < 7 ? i + 1 : i, !!v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !cells()[i] && i > 0) {
                  e.preventDefault();
                  const next = [...cells()];
                  next[i - 1] = "";
                  commit(next, i - 1, false);
                } else if (e.key === "ArrowLeft" && i > 0) {
                  e.preventDefault();
                  refs[i - 1]?.focus();
                } else if (e.key === "ArrowRight" && i < 7) {
                  e.preventDefault();
                  refs[i + 1]?.focus();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  props.onComplete(cells().join(""));
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const t = clean(e.clipboardData?.getData("text") ?? "");
                if (t) fill(t, t.length >= 8 ? 0 : i);
              }}
            />
          </>
        )}
      </Index>
    </div>
  );
}
