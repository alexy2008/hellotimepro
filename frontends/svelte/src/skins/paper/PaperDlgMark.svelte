<!-- 确认框顶上盖的一枚朱文印（如删除时的「删」） -->
<script lang="ts">
  import PaperSeal from "./PaperSeal.svelte";

  let { ch }: { ch: string } = $props();
</script>

<div class="dlg__mark"><PaperSeal {ch} variant="line" /></div>
