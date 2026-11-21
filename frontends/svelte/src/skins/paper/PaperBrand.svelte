<script lang="ts">
  import PaperLogo from "./PaperLogo.svelte";

  let { label }: { label?: string } = $props();
</script>

<a class="brand" href="/" aria-label={label}>
  <PaperLogo />
  <span class="brand__name latin">HelloTime</span>
  <sup class="brand__pro mono">PRO</sup>
</a>
