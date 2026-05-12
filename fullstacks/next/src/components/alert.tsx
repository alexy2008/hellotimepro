"use client";

import type { CSSProperties, ReactNode } from "react";

type Variant = "info" | "success" | "danger";

const ICON: Record<Variant, string> = {
  info: "ⓘ",
  success: "✓",
  danger: "⚠",
};

export function Alert({
  variant = "info",
  children,
  style,
}: {
  variant?: Variant;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={`cy-alert cy-alert--${variant}`} style={style}>
      <span>{ICON[variant]}</span>
      <span>{children}</span>
    </div>
  );
}
