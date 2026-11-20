<!-- 邮戳：外圈文字沿圆排布，略微歪斜，像用手盖上去的 -->
<script setup lang="ts">
import { useId } from "vue";
import { fmt } from "@/lib/fmt";

withDefaults(defineProps<{ date: number; label?: string }>(), { label: "已开启" });
const id = `st-${useId()}`;
</script>

<template>
  <svg class="stamp" viewBox="0 0 140 140" aria-hidden="true">
    <defs>
      <path :id="id" d="M18 70a52 52 0 1 1 104 0a52 52 0 1 1-104 0" />
    </defs>
    <circle class="stamp__ring" cx="70" cy="70" r="66" />
    <circle class="stamp__ring stamp__ring--in" cx="70" cy="70" r="40" />
    <text class="stamp__arc">
      <textPath :href="`#${id}`" textLength="316" lengthAdjust="spacing">HELLOTIME PRO · 时间胶囊 · TIME CAPSULE ·</textPath>
    </text>
    <text class="stamp__label" x="70" y="68" text-anchor="middle">{{ label }}</text>
    <text class="stamp__date" x="70" y="86" text-anchor="middle">{{ fmt.date(date) }}</text>
  </svg>
</template>
