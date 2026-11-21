<script lang="ts">
  import AmberBadge from "./AmberBadge.svelte";

  let { inPlaza }: { inPlaza: boolean } = $props();
</script>

{#if inPlaza}
  <AmberBadge kind="plaza" icon="globe">广场公开</AmberBadge>
{:else}
  <AmberBadge kind="private" icon="lock">仅凭码可见</AmberBadge>
{/if}
