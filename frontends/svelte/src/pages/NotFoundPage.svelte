<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import PaperNotFoundPage from "@/skins/paper/PaperNotFoundPage.svelte";
  import AmberNotFoundPage from "@/skins/amber/AmberNotFoundPage.svelte";
</script>

{#if ui.skin === "paper"}<PaperNotFoundPage />{:else}<AmberNotFoundPage />{/if}
