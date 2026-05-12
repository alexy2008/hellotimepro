<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useThemeStore } from "@/stores/theme";

const store = useThemeStore();
const { theme } = storeToRefs(store);
</script>

<template>
  <button
    type="button"
    class="cy-theme-toggle"
    aria-label="切换主题"
    @click="store.toggle()"
  >
    <span aria-hidden="true">{{ theme === "dark" ? "☾" : "☀" }}</span>
  </button>
</template>
