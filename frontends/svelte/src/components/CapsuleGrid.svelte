<script lang="ts">
  import type { Snippet } from "svelte";
  import type { CapsuleListItem } from "@/types";
  import CapsuleCard from "./CapsuleCard.svelte";

  interface Props {
    items: CapsuleListItem[];
    loading?: boolean;
    showCreator?: boolean;
    hideFavorite?: boolean;
    /** 每张卡片点击跳转的路径；默认 /capsules/:code */
    hrefFn?: (c: CapsuleListItem) => string;
    /** 自定义空态 */
    empty?: Snippet;
    /** 自定义每张卡片右侧的操作（透传给 CapsuleCard 的 right slot） */
    card?: Snippet<[CapsuleListItem]>;
  }

  let {
    items,
    loading = false,
    showCreator = true,
    hideFavorite = false,
    hrefFn,
    empty,
    card,
  }: Props = $props();
</script>

{#if loading && items.length === 0}
  <div class="cy-empty">
    <div class="cy-empty__emoji">⏳</div>
    <p>加载中…</p>
  </div>
{:else if !loading && items.length === 0}
  {#if empty}
    {@render empty()}
  {:else}
    <div class="cy-empty"><p>暂无数据</p></div>
  {/if}
{:else}
  <div class="cy-grid">
    {#each items as c (c.id)}
      <CapsuleCard capsule={c} href={hrefFn?.(c)} {showCreator} {hideFavorite} right={card} />
    {/each}
  </div>
{/if}
