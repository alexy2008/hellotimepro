<!-- 「时笺」页脚：品牌题记 + 「本页由以下技术栈排印」（前端 × 当前后端，来自 /health） -->
<script lang="ts">
  import { FRONTEND_STACK } from "@/lib/about";
  import { health } from "@/stores/health.svelte.ts";
  import PaperBrand from "./PaperBrand.svelte";
  import PaperStackLi from "./PaperStackLi.svelte";

  health.load();
</script>

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
          <span class={["dot", health.online && "dot--on"]}></span>
          {health.online === false ? "后端离线" : health.online ? `后端在线 · ${health.backendName ?? ""}` : "连接中…"}
        </span>
      </div>
      <ul class="stack" data-testid="footer-stack">
        {#each FRONTEND_STACK as it (`f-${it.name}`)}<PaperStackLi {it} />{/each}
        {#if health.backend.length}<li class="stack__x" aria-hidden="true">×</li>{/if}
        {#each health.backend as it (`b-${it.role}-${it.name}`)}<PaperStackLi {it} />{/each}
      </ul>
    </div>
  </div>
  <div class="wrap ftr__base">
    <span>© 2026 HelloTime Pro · MIT License</span>
    <nav aria-label="页脚">
      <a href="/">广场</a>
      <a href="/open">开启</a>
      <a href="/about">关于</a>
    </nav>
  </div>
</footer>
