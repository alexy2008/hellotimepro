<!-- 头像：spec/avatars/v2 的单线徽记，颜色由 --av 与皮肤样式决定 -->
<script setup lang="ts">
import { computed } from "vue";
import { avatarOf } from "@/lib/avatars";

const props = defineProps<{ id: string | null | undefined }>();
const a = computed(() => avatarOf(props.id));
</script>

<template>
  <span class="av" :style="{ '--av': a.color }" aria-hidden="true">
    <svg viewBox="0 0 24 24" v-html="a.glyph" />
  </span>
</template>
