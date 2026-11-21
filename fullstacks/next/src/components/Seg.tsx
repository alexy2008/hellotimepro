// ============================================================
// 分段选择：一排按钮 + 一块跟着选中项滑动的底（.seg__thumb）。
// 两套皮肤同一份标记，长相由 spec/styles 决定。
// ============================================================

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number | null;
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  testId: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<CSSProperties>({});
  const placed = useRef(false);

  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const a = box.current?.querySelector<HTMLElement>(".seg__opt.is-active");
      if (!a) return;
      setThumb({
        width: a.offsetWidth,
        transform: `translateX(${a.offsetLeft}px)`,
        transition: animate ? undefined : "none",
      });
    };
    place(placed.current);
    placed.current = true;
    // 字体晚到会改变按钮宽度，再量一次
    void document.fonts?.ready.then(() => place(false));
    // 数量从无到有也会改变宽度
  }, [value, options.map((o) => o.count ?? "").join(",")]);

  return (
    <div className="seg" ref={box} role="group" aria-label={label}>
      <span className="seg__thumb" style={thumb} />
      {options.map((o) => (
        <button
          key={o.value}
          className={`seg__opt${o.value === value ? " is-active" : ""}`}
          type="button"
          aria-pressed={o.value === value}
          data-testid={testId}
          data-value={o.value}
          data-selected={o.value === value}
          data-count={o.count ?? undefined}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
          {o.count != null ? <sup>{o.count}</sup> : null}
        </button>
      ))}
    </div>
  );
}
