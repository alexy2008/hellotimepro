<!-- 火漆：不规则蜡滴 + 径向渐变 + 双层印字 -->
<script setup lang="ts">
import { useId } from "vue";
import { WAX_IN, WAX_OUT } from "./art";

withDefaults(defineProps<{ ch?: string }>(), { ch: "封" });
const g = `wax-${useId()}`;
</script>

<template>
  <span class="wax" aria-hidden="true">
    <svg viewBox="0 0 100 100">
      <defs>
        <radialGradient :id="g" cx="36%" cy="30%" r="78%">
          <stop offset="0" style="stop-color: var(--wax-hi)" />
          <stop offset=".5" style="stop-color: var(--wax)" />
          <stop offset="1" style="stop-color: var(--wax-lo)" />
        </radialGradient>
      </defs>
      <path :d="WAX_OUT" fill="var(--wax-lo)" />
      <path :d="WAX_IN" :fill="`url(#${g})`" />
      <circle cx="50" cy="50" r="30.5" fill="none" stroke="var(--wax-lo)" stroke-width="2.4" opacity=".5" />
      <circle cx="50.7" cy="50.8" r="30.5" fill="none" stroke="var(--wax-hi)" stroke-width=".9" opacity=".55" />
      <text class="wax__ch wax__ch--hi" x="50.9" y="51.1" text-anchor="middle" dy=".36em">{{ ch }}</text>
      <text class="wax__ch" x="50" y="50" text-anchor="middle" dy=".36em">{{ ch }}</text>
      <ellipse cx="35" cy="29" rx="15" ry="7.5" fill="#fff" opacity=".17" transform="rotate(-30 35 29)" />
    </svg>
  </span>
</template>
