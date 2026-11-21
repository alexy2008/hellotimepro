<script lang="ts">
  import AppIcon from "@/components/AppIcon.svelte";

  let { inPlaza }: { inPlaza: boolean } = $props();
</script>

{#if inPlaza}
  <span class="tag"><AppIcon name="globe" />广场公开</span>
{:else}
  <span class="tag tag--quiet"><AppIcon name="lock" />仅凭码可见</span>
{/if}
