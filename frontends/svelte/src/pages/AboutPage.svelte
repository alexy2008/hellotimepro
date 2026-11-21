<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import PaperAboutPage from "@/skins/paper/PaperAboutPage.svelte";
  import AmberAboutPage from "@/skins/amber/AmberAboutPage.svelte";
</script>

{#if ui.skin === "paper"}<PaperAboutPage />{:else}<AmberAboutPage />{/if}
