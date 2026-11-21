<!-- 登录提示框顶部的小标记：时笺盖一枚朱文印，琥珀是一个图标 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import type { IconName } from "@/lib/icons";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperSeal from "@/skins/paper/PaperSeal.svelte";

  let { ch, icon }: { ch: string; icon: IconName } = $props();
</script>

<div class="dlg__mark">
  {#if ui.skin === "paper"}
    <PaperSeal {ch} variant="line" />
  {:else}
    <AppIcon name={icon} />
  {/if}
</div>
