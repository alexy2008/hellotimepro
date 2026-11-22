<!-- 翻页数字的一位：变化时旧数字向上退出、新数字从下方进入 -->
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ v: string }>();
const prev = ref<string | null>(null);
let t = 0;
watch(
  () => props.v,
  (_, old) => {
    prev.value = old;
    clearTimeout(t);
    t = window.setTimeout(() => (prev.value = null), 520);
  },
);
onBeforeUnmount(() => clearTimeout(t));
</script>

<template>
  <span class="dg" :data-v="v">
    <span v-if="prev !== null" :key="`o${prev}`" class="dg__out">{{ prev }}</span>
    <span :key="v" :class="['dg__cur', { dg__in: prev !== null }]">{{ v }}</span>
  </span>
</template>
