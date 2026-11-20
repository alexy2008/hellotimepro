<!-- 「我的」列表底部的「加载更多」：还有下一页时才出现（测试钩子 list-next） -->
<script setup lang="ts">
defineProps<{ show: boolean; busy: boolean; left: number }>();
defineEmits<{ more: [] }>();
</script>

<template>
  <div v-if="show" class="list-more">
    <button :class="['btn', 'btn--ghost', { 'is-busy': busy }]" type="button" :disabled="busy" data-testid="list-next" @click="$emit('more')">
      {{ busy ? "加载中…" : `加载更多（还有 ${left} 枚）` }}
    </button>
  </div>
</template>

<style scoped>
/* 本前端的样式胶水：只用 base.css 刻度 */
.list-more {
  display: flex;
  justify-content: center;
  margin-top: var(--space-8);
}
</style>
