<script lang="ts">
  import type { Snippet } from "svelte";
  import AppHeader from "./AppHeader.svelte";
  import AppFooter from "./AppFooter.svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<AppHeader />
{@render children()}
<AppFooter />
