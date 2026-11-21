<!-- 「琥珀」页脚：品牌 · 技术栈小片（前端 × 当前后端，来自 /health）· 版本 -->
<script lang="ts">
  import { FRONTEND_STACK } from "@/lib/about";
  import { health } from "@/stores/health.svelte.ts";
  import AmberChip from "./AmberChip.svelte";
  import AmberLogo from "./AmberLogo.svelte";

  health.load();
</script>

<footer class="ftr">
  <div class="ftr__in">
    <a class="ftr__brand" href="/">
      <AmberLogo size={22} />
      HelloTime Pro · 时间胶囊
    </a>
    <div class="ftr__stack" data-testid="footer-stack">
      <span class="ftr__dot" title={health.online === false ? "后端离线" : "后端在线"} data-online={health.online ?? undefined}></span>
      {#each FRONTEND_STACK as it (`f-${it.name}`)}<AmberChip {it} />{/each}
      {#if health.backend.length}<i class="ftr__x">×</i>{/if}
      {#each health.backend as it (`b-${it.role}-${it.name}`)}<AmberChip {it} />{/each}
    </div>
    <div class="ftr__meta">
      <span>把此刻，寄给未来</span>
      <span class="mono">v2.0</span>
    </div>
  </div>
</footer>
