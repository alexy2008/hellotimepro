<!-- 技术栈图标：有图就用后端托管的 SVG，没有就退成两个字。base 是皮肤给的类名（tech__ic / tech-ic） -->
<script lang="ts">
  import type { StackItem } from "@/types";

  let { item, base }: { item: Pick<StackItem, "name" | "iconUrl">; base: string } = $props();
</script>

{#if item.iconUrl}
  <img class={base} src={item.iconUrl} alt="" loading="lazy" />
{:else}
  <span class={[base, `${base}--txt`]} aria-hidden="true">{item.name.replace(/[^A-Za-z一-龥]/g, "").slice(0, 2)}</span>
{/if}
