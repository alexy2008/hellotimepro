// ============================================================
// 「琥珀」8 格输码：8 个展示格 + 一个盖在上面的透明原生输入框
// （键盘、粘贴、输入法都交给它）。size：'md' 首页 / 'lg' 开启页。
// ============================================================

import { EMPTY_CELL, completeCode } from "@/hooks/useCodeOpen";
import { focusIfIdle } from "@/lib/fmt";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CodeState } from "@/hooks/useCodeOpen";

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

export interface CodeInputHandle {
  set: (v: string) => void;
}

interface Props {
  size?: "" | "md" | "lg";
  value: string;
  state: CodeState;
  shake: number;
  onChange?: (v: string) => void;
  onComplete: (v: string) => void;
  autoFocus?: boolean;
  /** 外部写入整码（粘贴识别用） */
  handle?: React.Ref<CodeInputHandle>;
}

export function AmberCodeInput({ size = "", value, state, shake, onChange, onComplete, autoFocus, handle }: Props) {
  const [focused, setFocused] = useState(false);
  const [shaking, setShaking] = useState(false);
  const prev = useRef("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shake) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 480);
    return () => clearTimeout(t);
  }, [shake]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => focusIfIdle(input.current), 350);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  useImperativeHandle(handle, () => ({
    set: (v: string) => {
      const s = clean(v);
      onChange?.(s);
      if (s.length === 8) onComplete(s);
    },
  }));

  function update(raw: string) {
    const v = raw.toUpperCase().replace(/[^A-Z0-9\u00a0]/g, "").slice(0, 8).trimEnd();
    onChange?.(v);
    if (completeCode(v)) onComplete(v);
  }

  // 本次新敲进来的格子「弹」一下：prev 是上一次渲染时的值
  const grew = value.length > prev.current.length;
  const popFrom = prev.current.length;
  useEffect(() => {
    prev.current = value;
  });

  return (
    <div
      className={[
        "code",
        size ? `code--${size}` : "",
        focused ? "is-focused" : "",
        state === "error" ? "is-error" : "",
        state === "checking" ? "is-checking" : "",
        state === "ok" ? "is-ok" : "",
        shaking ? "is-shake" : "",
      ].filter(Boolean).join(" ")}
    >
      <input
        ref={input}
        className="code__native"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        aria-label="8 位胶囊码"
        data-testid="code-input"
        value={value}
        onChange={(e) => {
          const ev = e.nativeEvent as InputEvent;
          if (ev.isComposing) return;
          // 一次进来一整串码（粘贴、自动填充）：与时笺一样整码从头填，不接在已经输入的几位后面
          const chunk = clean(ev.data ?? "");
          update(completeCode(chunk) ? chunk : e.target.value);
        }}
        onCompositionEnd={(e) => update(e.currentTarget.value)}
        onPaste={(e) => {
          const code = clean(e.clipboardData.getData("text"));
          if (!completeCode(code)) return;
          e.preventDefault();
          update(code);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onComplete(value);
          }
        }}
        onFocus={(e) => {
          setFocused(true);
          const gap = value.indexOf(EMPTY_CELL);
          if (gap >= 0) e.currentTarget.setSelectionRange(gap, gap + 1);
          else e.currentTarget.setSelectionRange(value.length, value.length);
        }}
        onBlur={() => setFocused(false)}
      />
      <div className="code__cells" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => {
          const ch = value[i] === EMPTY_CELL ? "" : value[i] ?? "";
          return (
            <span
              key={i}
              className={[
                "code__cell",
                i === 4 ? "has-gap" : "",
                ch ? "is-filled" : "",
                ch && grew && i >= popFrom ? "is-pop" : "",
                i === Math.min(value.length, 7) ? "is-active" : "",
              ].filter(Boolean).join(" ")}
              data-code-cell=""
              data-value={ch}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}
