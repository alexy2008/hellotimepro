<script setup lang="ts">
type Variant = "info" | "success" | "danger";

const props = withDefaults(
  defineProps<{ variant?: Variant }>(),
  { variant: "info" },
);

const ICON: Record<Variant, string> = {
  info: "ⓘ",
  success: "✓",
  danger: "⚠",
};
</script>

<template>
  <div :class="`cy-alert cy-alert--${props.variant}`">
    <span>{{ ICON[props.variant] }}</span>
    <span><slot /></span>
  </div>
</template>
