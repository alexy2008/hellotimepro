<!-- 「时笺」页脚：品牌题记 + 「本页由以下技术栈排印」（前端 × 当前后端，来自 /health） -->
<script setup lang="ts">
import { FRONTEND_STACK } from "@/lib/about";
import { useHealth } from "@/composables/useShell";
import PaperBrand from "./PaperBrand.vue";
import PaperStackLi from "./PaperStackLi.vue";

const { online, backend, backendName } = useHealth();
</script>

<template>
  <footer class="ftr">
    <div class="wrap ftr__in">
      <div class="ftr__brand">
        <PaperBrand />
        <p class="ftr__motto serif">把此刻，寄给未来。</p>
        <p class="ftr__fine">一个多技术栈对比学习项目 · 不面向生产</p>
      </div>
      <div class="ftr__colo">
        <div class="ftr__k">
          <span>本页由以下技术栈排印</span>
          <span class="ftr__live">
            <span :class="['dot', { 'dot--on': online }]" />
            {{ online === false ? "后端离线" : online ? `后端在线 · ${backendName ?? ""}` : "连接中…" }}
          </span>
        </div>
        <ul class="stack" data-testid="footer-stack">
          <PaperStackLi v-for="it in FRONTEND_STACK" :key="`f-${it.name}`" :it="it" />
          <li v-if="backend.length" class="stack__x" aria-hidden="true">×</li>
          <PaperStackLi v-for="it in backend" :key="`b-${it.role}-${it.name}`" :it="it" />
        </ul>
      </div>
    </div>
    <div class="wrap ftr__base">
      <span>© 2026 HelloTime Pro · MIT License</span>
      <nav aria-label="页脚">
        <RouterLink to="/">广场</RouterLink>
        <RouterLink to="/open">开启</RouterLink>
        <RouterLink to="/about">关于</RouterLink>
      </nav>
    </div>
  </footer>
</template>
