<!-- 刻度尺：封存 → 启封 的等待进度（p 为百分比） -->
<script setup lang="ts">
defineProps<{ p: number }>();
</script>

<template>
  <div class="scale" :style="{ '--p': `${p}%` }">
    <i class="scale__fill" />
    <i class="scale__mark" />
  </div>
</template>
