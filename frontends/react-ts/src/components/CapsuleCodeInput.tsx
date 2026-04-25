import { useEffect, useRef } from "react";

interface Props {
  value: string; // 已输入字符（最多 8）
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
}

const LEN = 8;

export function CapsuleCodeInput({ value, onChange, onComplete }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length: LEN }, (_, i) =>
    (value[i] ?? "").toUpperCase(),
  );

  useEffect(() => {
    if (value.length === LEN) onComplete?.(value);
  }, [value, onComplete]);

  function setAt(i: number, ch: string) {
    const sanitized = ch.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const next = (chars.slice(0, i).join("") + sanitized + chars.slice(i + 1).join(""))
      .slice(0, LEN);
    onChange(next);
    if (sanitized && i < LEN - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LEN - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, LEN);
    onChange(text);
    refs.current[Math.min(text.length, LEN - 1)]?.focus();
  }

  return (
    <div className="cy-code-input">
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          maxLength={1}
          value={ch}
          onChange={(e) => setAt(i, e.target.value.slice(-1))}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          aria-label={`第 ${i + 1} 位`}
        />
      ))}
    </div>
  );
}
