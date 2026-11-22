<script setup lang="ts">
import PaperLogo from "./PaperLogo.vue";

defineProps<{ label?: string }>();
</script>

<template>
  <NuxtLink class="brand" to="/" :aria-label="label">
    <PaperLogo />
    <span class="brand__name latin">HelloTime</span>
    <sup class="brand__pro mono">PRO</sup>
  </NuxtLink>
</template>
