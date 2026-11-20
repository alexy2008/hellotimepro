<!-- 线性图标：路径是 lib/icons.ts 里的常量，不含用户输入，可以放心 v-html。
     class 会自动并到 .ic 上（如 class="ic--go"） -->
<script setup lang="ts">
import { ICONS, type IconName } from "@/lib/icons";

defineProps<{ name: IconName }>();
</script>

<template>
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS[name]" />
</template>
