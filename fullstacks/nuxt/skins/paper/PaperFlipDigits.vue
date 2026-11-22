<!-- 逐位翻动的数字：只有变了的那一位会动 -->
<script setup lang="ts">
import PaperFlipDigit from "./PaperFlipDigit.vue";

defineProps<{ value: string }>();
</script>

<template>
  <PaperFlipDigit v-for="(ch, i) in Array.from(value)" :key="i" :v="ch" />
</template>
