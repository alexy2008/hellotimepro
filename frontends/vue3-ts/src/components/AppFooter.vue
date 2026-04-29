<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { api } from "@/api/client";
import type { HealthData } from "@/types";

const FRONTEND_ITEMS = [
  { role: "frontend-framework", name: "Vue 3", iconUrl: "/static/icons/vue.svg" },
  { role: "frontend-language", name: "TypeScript", iconUrl: "/static/icons/typescript.svg" },
];

const health = ref<HealthData | null>(null);
const connected = ref<boolean | null>(null);

onMounted(async () => {
  try {
    health.value = await api.health();
    connected.value = true;
  } catch {
    connected.value = false;
  }
});

const backendItems = computed(() => health.value?.stack.items ?? []);
const dotClass = computed(() => {
  if (connected.value === true) return "cy-backend-dot cy-backend-dot--online";
  if (connected.value === false) return "cy-backend-dot cy-backend-dot--offline";
  return "cy-backend-dot";
});
const dotTitle = computed(() => {
  if (connected.value === true) return "后端在线";
  if (connected.value === false) return "后端离线";
  return "连接中…";
});
</script>

<template>
  <footer class="cy-footer">
    <div class="cy-container cy-footer__inner">
      <div style="display:flex;align-items:center;gap:6px">
        © 2026 HelloTime Pro
        <span :class="dotClass" :title="dotTitle" />
      </div>
      <div class="cy-stack">
        <span
          v-for="it in FRONTEND_ITEMS"
          :key="it.role"
          class="cy-stack__item"
          :title="it.role"
        >
          <img :src="it.iconUrl" alt="" />
          {{ it.name }}
        </span>
        <span
          v-for="it in backendItems"
          :key="`${it.role}-${it.name}`"
          class="cy-stack__item"
          :title="it.role"
        >
          <img v-if="it.iconUrl" :src="it.iconUrl" alt="" />
          {{ it.name }}
        </span>
      </div>
    </div>
  </footer>
</template>
