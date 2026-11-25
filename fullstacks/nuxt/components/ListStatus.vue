<!-- 「我的」列表第一页还没到手时的占位：加载中提示，或加载失败 + 重试（与 next 的 ListStatus 一致） -->
<script setup lang="ts">
defineProps<{ error: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <p v-if="!error" role="status">正在加载胶囊…</p>
  <div v-else role="alert" data-testid="list-error">
    <p>胶囊列表暂时无法加载。</p>
    <button type="button" class="btn btn--ghost" data-testid="list-retry" @click="$emit('retry')">重试</button>
  </div>
</template>
