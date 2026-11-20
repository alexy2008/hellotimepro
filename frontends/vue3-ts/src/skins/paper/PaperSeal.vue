<!-- 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」） -->
<script setup lang="ts">
withDefaults(defineProps<{ ch: string; variant?: "solid" | "line" }>(), { variant: "solid" });
</script>

<template>
  <span :class="['seal', `seal--${variant}`]" aria-hidden="true">{{ ch }}</span>
</template>
