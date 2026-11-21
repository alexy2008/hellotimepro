<!-- 开启页（/open）：路由持有输码状态，切皮肤时已输入的码与提示都还在 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { provideCodeOpen } from "@/state/code-open.svelte.ts";
  import PaperOpenPage from "@/skins/paper/PaperOpenPage.svelte";
  import AmberOpenPage from "@/skins/amber/AmberOpenPage.svelte";

  provideCodeOpen();
</script>

{#if ui.skin === "paper"}<PaperOpenPage />{:else}<AmberOpenPage />{/if}
