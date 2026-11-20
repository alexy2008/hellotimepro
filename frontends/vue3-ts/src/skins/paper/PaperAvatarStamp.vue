<!-- 邮票：头像徽记 + 齿孔边（label=false 时不写名字） -->
<script setup lang="ts">
import { computed } from "vue";
import { avatarOf } from "@/lib/avatars";

const props = withDefaults(defineProps<{ id: string; label?: boolean }>(), { label: true });
const a = computed(() => avatarOf(props.id));
</script>

<template>
  <span class="stamp" :style="{ '--av': a.color }">
    <span class="stamp__in">
      <svg viewBox="0 0 24 24" aria-hidden="true" v-html="a.glyph" />
      <b v-if="label">{{ a.name }}</b>
    </span>
  </span>
</template>
