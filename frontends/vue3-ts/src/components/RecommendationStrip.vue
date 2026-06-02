<script setup lang="ts">
import type { CSSProperties } from "vue";
import type { CapsuleRecommendation } from "@/types";

// 三组主题色，按下标轮换，让灵感标签更有表现力（全部取自设计 token）
const PALETTES = ["brand", "accent", "signal"] as const;

defineProps<{
  recos: CapsuleRecommendation[];
  busy: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "pick", reco: CapsuleRecommendation): void;
  (e: "refresh"): void;
}>();

function chipStyle(index: number): CSSProperties {
  const p = PALETTES[index % PALETTES.length];
  // 文字保持默认色、无填充；仅用主色勾一道圆角边框做点缀
  return {
    whiteSpace: "nowrap",
    border: `1px solid var(--color-${p}-primary)`,
    borderRadius: "var(--radius-full)",
  };
}
</script>

<template>
  <div class="cy-field">
    <div style="display: flex; align-items: center; gap: var(--space-2)">
      <label style="margin: 0">✨ 没有头绪？试试这些灵感</label>
      <button
        type="button"
        class="cy-btn cy-btn--ghost cy-btn--sm"
        :disabled="busy || disabled"
        data-testid="reco-refresh"
        style="margin-left: auto"
        @click="emit('refresh')"
      >
        {{ busy ? "换一批中…" : "换一批" }}
      </button>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: var(--space-2)">
      <button
        v-for="(reco, i) in recos"
        :key="reco.title"
        type="button"
        class="cy-btn cy-btn--ghost cy-btn--sm"
        :disabled="busy || disabled"
        :title="reco.hint"
        data-testid="reco-chip"
        :style="chipStyle(i)"
        @click="emit('pick', reco)"
      >
        {{ reco.title }}
      </button>
    </div>
  </div>
</template>
