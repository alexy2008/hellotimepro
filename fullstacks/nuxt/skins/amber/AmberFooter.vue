<!-- 「琥珀」页脚：品牌 · 技术栈小片（前端 × 当前后端，来自 /health）· 版本 -->
<script setup lang="ts">
import { FRONTEND_STACK } from "@/lib/about";
import { useHealth } from "@/composables/useShell";
import AmberChip from "./AmberChip.vue";
import AmberLogo from "./AmberLogo.vue";

const { online, backend } = useHealth();
</script>

<template>
  <footer class="ftr">
    <div class="ftr__in">
      <NuxtLink class="ftr__brand" to="/">
        <AmberLogo :size="22" />
        HelloTime Pro · 时间胶囊
      </NuxtLink>
      <div class="ftr__stack" data-testid="footer-stack">
        <span class="ftr__dot" :title="online === false ? '服务离线' : '服务在线'" :data-online="online ?? undefined" />
        <AmberChip v-for="it in FRONTEND_STACK" :key="`f-${it.name}`" :it="it" />
        <i v-if="backend.length" class="ftr__x">×</i>
        <AmberChip v-for="it in backend" :key="`b-${it.role}-${it.name}`" :it="it" />
      </div>
      <div class="ftr__meta">
        <span>把此刻，寄给未来</span>
        <span class="mono">v2.0</span>
      </div>
    </div>
  </footer>
</template>
