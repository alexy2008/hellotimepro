<!-- 首页（/）：路由持有就地输码的状态；进入时、登录态变了、有胶囊到点时刷新广场 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { provideCodeOpen } from "@/state/code-open.svelte.ts";
  import { plazaHome } from "@/state/plaza-home.svelte.ts";
  import PaperHomePage from "@/skins/paper/PaperHomePage.svelte";
  import AmberHomePage from "@/skins/amber/AmberHomePage.svelte";

  provideCodeOpen();
  plazaHome();
</script>

{#if ui.skin === "paper"}<PaperHomePage />{:else}<AmberHomePage />{/if}
