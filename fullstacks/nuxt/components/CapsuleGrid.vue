<script setup lang="ts">
import CapsuleCard from "./CapsuleCard.vue";
import type { CapsuleListItem } from "@/types";

interface Props {
  items: CapsuleListItem[];
  loading?: boolean;
  showCreator?: boolean;
  hideFavorite?: boolean;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  showCreator: true,
  hideFavorite: false,
});
</script>

<template>
  <div v-if="loading && items.length === 0" class="cy-empty">
    <div class="cy-empty__emoji">⏳</div>
    <p>加载中…</p>
  </div>
  <template v-else-if="!loading && items.length === 0">
    <slot name="empty">
      <div class="cy-empty"><p>暂无数据</p></div>
    </slot>
  </template>
  <div v-else class="cy-grid">
    <CapsuleCard
      v-for="c in items"
      :key="c.id"
      :capsule="c"
      :show-creator="showCreator"
      :hide-favorite="hideFavorite"
    >
      <template v-if="$slots.card" #right>
        <slot name="card" :capsule="c" />
      </template>
    </CapsuleCard>
  </div>
</template>
