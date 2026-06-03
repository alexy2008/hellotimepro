import type { JSX } from "solid-js";

type Variant = "info" | "success" | "danger";

const ICON: Record<Variant, string> = {
  info: "ⓘ",
  success: "✓",
  danger: "⚠",
};

export function Alert(props: {
  variant?: Variant;
  children: JSX.Element;
  style?: JSX.CSSProperties;
}) {
  const variant = () => props.variant ?? "info";
  return (
    <div class={`cy-alert cy-alert--${variant()}`} style={props.style}>
      <span>{ICON[variant()]}</span>
      <span>{props.children}</span>
    </div>
  );
}
