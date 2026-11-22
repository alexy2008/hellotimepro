<!-- 技术栈图标：有图就用后端托管的 SVG，没有就退成两个字。base 是皮肤给的类名（tech__ic / tech-ic） -->
<script setup lang="ts">
import type { StackItem } from "@/types";

defineProps<{ item: Pick<StackItem, "name" | "iconUrl">; base: string }>();
</script>

<template>
  <img v-if="item.iconUrl" :class="base" :src="item.iconUrl" alt="" loading="lazy" />
  <span v-else :class="[base, `${base}--txt`]" aria-hidden="true">{{ item.name.replace(/[^A-Za-z一-龥]/g, "").slice(0, 2) }}</span>
</template>
