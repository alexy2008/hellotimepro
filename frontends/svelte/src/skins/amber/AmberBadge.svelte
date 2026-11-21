<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "@/lib/icons";
  import AppIcon from "@/components/AppIcon.svelte";

  let { kind, icon, children }: { kind: string; icon?: IconName; children: Snippet } = $props();
</script>

<span class={["badge", `badge--${kind}`]}>{#if icon}<AppIcon name={icon} />{/if}{@render children()}</span>
