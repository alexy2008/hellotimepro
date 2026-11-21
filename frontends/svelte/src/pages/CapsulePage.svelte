<!-- 详情（/capsules/:code）：路由持有这枚胶囊的数据；App 里按 code 加了 {#key}，换码即换实例 -->
<script lang="ts">
  import { untrack } from "svelte";
  import { ui } from "@/stores/ui.svelte.ts";
  import { provideCapsule } from "@/state/capsule.svelte.ts";
  import PaperCapsulePage from "@/skins/paper/PaperCapsulePage.svelte";
  import AmberCapsulePage from "@/skins/amber/AmberCapsulePage.svelte";

  let { code }: { code: string } = $props();
  // App 按 code 加了 {#key}：这个实例的 code 不会变
  provideCapsule(untrack(() => code));
</script>

{#if ui.skin === "paper"}<PaperCapsulePage />{:else}<AmberCapsulePage />{/if}
