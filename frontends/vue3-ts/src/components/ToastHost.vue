<!-- 提示条容器：页面底部居中，逐条淡入淡出 -->
<script setup lang="ts">
import { useFeedbackStore } from "@/stores/feedback";
import AppIcon from "@/components/AppIcon.vue";

const fb = useFeedbackStore();
const cls = { error: "err", info: "info", success: "ok" } as const;
const icon = { error: "alert", info: "info", success: "check" } as const;
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div
      v-for="t in fb.toasts"
      :key="t.id"
      data-testid="toast"
      :data-tone="t.tone"
      :class="['toast', `toast--${cls[t.tone]}`, { 'is-in': t.shown }]"
    >
      <AppIcon :name="icon[t.tone]" />
      <span>{{ t.msg }}</span>
    </div>
  </div>
</template>
