<!-- 邮戳：外圈两行弧形字，中间两行日期 -->
<script setup lang="ts">
import { useId } from "vue";

withDefaults(defineProps<{ line1?: string; line2?: string; top?: string; bottom?: string }>(), {
  line1: "",
  line2: "",
  top: "HELLOTIME · POST",
  bottom: "时 光 邮 局",
});
const id = `pm-${useId()}`;
</script>

<template>
  <svg class="pm" viewBox="0 0 172 120" aria-hidden="true">
    <defs>
      <path :id="`${id}a`" d="M16.5,60 a43.5,43.5 0 1,1 87,0" />
      <path :id="`${id}b`" d="M9.5,60 a50.5,50.5 0 0,0 101,0" />
    </defs>
    <g class="pm__ring">
      <circle cx="60" cy="60" r="56" />
      <circle cx="60" cy="60" r="37" />
    </g>
    <text class="pm__arc"><textPath :href="`#${id}a`" startOffset="50%" text-anchor="middle">{{ top }}</textPath></text>
    <text class="pm__arc pm__arc--cn"><textPath :href="`#${id}b`" startOffset="50%" text-anchor="middle">{{ bottom }}</textPath></text>
    <text class="pm__l1" x="60" y="59" text-anchor="middle">{{ line1 }}</text>
    <text class="pm__l2" x="60" y="74" text-anchor="middle">{{ line2 }}</text>
    <g class="pm__waves">
      <path v-for="y in [34, 47, 60, 73, 86]" :key="y" :d="`M120 ${y}q6.5-5 13 0t13 0 13 0 13 0`" />
    </g>
  </svg>
</template>
