import { createEffect, Index } from "solid-js";

const LEN = 8;

export function CapsuleCodeInput(props: {
  value: string; // 已输入字符（最多 8）
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
}) {
  const refs: Array<HTMLInputElement | undefined> = [];
  const chars = () =>
    Array.from({ length: LEN }, (_, i) => (props.value[i] ?? "").toUpperCase());

  createEffect(() => {
    if (props.value.length === LEN) props.onComplete?.(props.value);
  });

  function setAt(i: number, ch: string) {
    const sanitized = ch.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cur = chars();
    const next = (
      cur.slice(0, i).join("") +
      sanitized +
      cur.slice(i + 1).join("")
    ).slice(0, LEN);
    props.onChange(next);
    if (sanitized && i < LEN - 1) refs[i + 1]?.focus();
  }

  function handleKey(i: number, e: KeyboardEvent) {
    const cur = chars();
    if (e.key === "Backspace" && !cur[i] && i > 0) {
      refs[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LEN - 1) {
      refs[i + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = (e.clipboardData?.getData("text") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, LEN);
    props.onChange(text);
    refs[Math.min(text.length, LEN - 1)]?.focus();
  }

  return (
    <div class="cy-code-input">
      <Index each={chars()}>
        {(ch, i) => (
          <input
            ref={(el) => (refs[i] = el)}
            type="text"
            inputmode="text"
            autocapitalize="characters"
            maxlength={1}
            value={ch()}
            onInput={(e) => setAt(i, e.currentTarget.value.slice(-1))}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            aria-label={`第 ${i + 1} 位`}
          />
        )}
      </Index>
    </div>
  );
}
