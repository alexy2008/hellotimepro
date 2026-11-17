// ============================================================
// 「时笺」8 格输码：8 个真实输入框（四四分组）。
// 粘贴、自动填充或一次填入整码（测试里的 fill）都会分发到各格。
// size：'' 为开启页的大号，'sm' 为首页的小号。
// ============================================================

import { focusIfIdle } from "@/lib/fmt";
import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import type { CodeState } from "@/hooks/useCodeOpen";

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export interface CodeInputHandle {
  set: (v: string) => void;
}

interface Props {
  size?: "" | "sm";
  state: CodeState;
  shake: number;
  onChange?: (v: string) => void;
  onComplete: (v: string) => void;
  autoFocus?: boolean;
  /** 外部写入整码（粘贴识别用） */
  handle?: React.Ref<CodeInputHandle>;
  id?: string;
}

export function PaperCodeInput({ size = "", state, shake, onChange, onComplete, autoFocus, id, handle }: Props) {
  const [cells, setCells] = useState<string[]>(() => Array(8).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!shake) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 480);
    refs.current[7]?.focus();
    return () => clearTimeout(t);
  }, [shake]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => focusIfIdle(refs.current[0]), 350);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const commit = (next: string[], focusAt: number, completeNow: boolean) => {
    setCells(next);
    const v = next.join("");
    onChange?.(v);
    refs.current[Math.min(7, focusAt)]?.focus();
    if (completeNow && v.length === 8) onComplete(v);
  };

  useImperativeHandle(handle, () => ({
    set: (v: string) => {
      const s = clean(v).slice(0, 8);
      commit(Array.from({ length: 8 }, (_, k) => s[k] ?? ""), s.length, true);
    },
  }));

  /** 从第 from 格开始填入一串字符 */
  const fill = (str: string, from: number) => {
    const s = clean(str).slice(0, 8 - from);
    const next = [...cells];
    Array.from(s).forEach((ch, k) => (next[from + k] = ch));
    commit(next, from + s.length, true);
  };

  return (
    <div
      id={id}
      className={[
        "code",
        size ? `code--${size}` : "",
        state === "error" ? "is-error" : "",
        state === "checking" ? "is-checking" : "",
        state === "ok" ? "is-ok" : "",
        shaking ? "is-shake" : "",
      ].filter(Boolean).join(" ")}
      role="group"
      aria-label="8 位胶囊码"
    >
      {cells.map((ch, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i === 4 ? <span className="code__dash" aria-hidden="true" /> : null}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`code__cell mono${ch ? " is-filled" : ""}`}
            type="text"
            inputMode="text"
            maxLength={i === 0 ? 8 : 1}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label={`第 ${i + 1} 位`}
            style={{ "--k": i } as CSSProperties}
            value={ch}
            data-testid={i === 0 ? "code-input" : undefined}
            data-code-cell=""
            data-value={ch}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const v = clean(e.target.value);
              // 一次进来不止一个字符：当作从这一格开始粘贴（整码则从头填）
              if (v.length > 1) return fill(v, v.length >= 8 ? 0 : i);
              const next = [...cells];
              next[i] = v;
              commit(next, v && i < 7 ? i + 1 : i, i === 7 && !!v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !cells[i] && i > 0) {
                e.preventDefault();
                const next = [...cells];
                next[i - 1] = "";
                commit(next, i - 1, false);
              } else if (e.key === "ArrowLeft" && i > 0) {
                e.preventDefault();
                refs.current[i - 1]?.focus();
              } else if (e.key === "ArrowRight" && i < 7) {
                e.preventDefault();
                refs.current[i + 1]?.focus();
              } else if (e.key === "Enter") {
                e.preventDefault();
                onComplete(cells.join(""));
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              const t = clean(e.clipboardData.getData("text"));
              if (t) fill(t, t.length >= 8 ? 0 : i);
            }}
          />
        </span>
      ))}
    </div>
  );
}
