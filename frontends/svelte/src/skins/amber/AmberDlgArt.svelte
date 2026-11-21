<!-- 删除确认框顶上放这枚胶囊的插画 -->
<script lang="ts">
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";

  let { code }: { code: string } = $props();
</script>

<div class="dlg__art"><AmberCapsuleArt {code} state="opened" width={120} /></div>
