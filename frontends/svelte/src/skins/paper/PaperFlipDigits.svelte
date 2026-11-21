<!-- 逐位翻动的数字：只有变了的那一位会动 -->
<script lang="ts">
  import PaperFlipDigit from "./PaperFlipDigit.svelte";

  let { value }: { value: string } = $props();
</script>

{#each Array.from(value) as ch, i (i)}<PaperFlipDigit v={ch} />{/each}
