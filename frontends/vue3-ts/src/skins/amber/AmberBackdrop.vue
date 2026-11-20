<!-- 「琥珀」背景：光晕 + 粒子画布 + 颗粒（「时笺」下由 shell.css 隐藏）。只在琥珀皮肤下绘制 -->
<script setup lang="ts">
import { useTemplateRef, watchEffect } from "vue";
import { useUiStore } from "@/stores/ui";
import { startSky } from "./sky";

const ui = useUiStore();
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");

// 换皮肤 / 换明暗时重启（onCleanup 先停掉上一轮）
watchEffect((onCleanup) => {
  if (ui.skin !== "amber" || !canvas.value) return;
  onCleanup(startSky(canvas.value, ui.theme !== "light"));
});
</script>

<template>
  <div class="bg" aria-hidden="true">
    <div class="bg__aurora bg__aurora--a" />
    <div class="bg__aurora bg__aurora--b" />
    <div class="bg__aurora bg__aurora--c" />
    <canvas ref="canvas" class="bg__canvas" />
    <div class="bg__grain" />
  </div>
</template>
