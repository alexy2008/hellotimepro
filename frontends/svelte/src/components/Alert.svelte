<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "info" | "success" | "danger";

  interface Props {
    variant?: Variant;
    children: Snippet;
  }

  let { variant = "info", children }: Props = $props();

  const ICON: Record<Variant, string> = {
    info: "ⓘ",
    success: "✓",
    danger: "⚠",
  };
</script>

<div class={`cy-alert cy-alert--${variant}`}>
  <span>{ICON[variant]}</span>
  <span>{@render children()}</span>
</div>
