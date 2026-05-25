<script lang="ts">
  import { link } from "svelte-routing";
  import { api } from "@/api/client";
  import type { CapsuleListItem, Pagination as PaginationT } from "@/types";
  import CapsuleGrid from "@/components/CapsuleGrid.svelte";
  import FavoriteButton from "@/components/FavoriteButton.svelte";
  import Pagination from "@/components/Pagination.svelte";

  const PAGE_SIZE = 15;

  let items = $state<CapsuleListItem[]>([]);
  let pagination = $state<PaginationT | null>(null);
  let page = $state(1);
  let loading = $state(true);

  async function load() {
    loading = true;
    try {
      const r = await api.myFavorites(page, PAGE_SIZE);
      items = r.items;
      pagination = r.pagination;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    page;
    void load();
  });
</script>

<h1>我收藏的胶囊</h1>
<p style:color="var(--color-text-secondary)" style:margin="0 0 var(--space-6)">
  共 {pagination?.total ?? 0} 条；取消收藏只会从此列表移除，不会影响原胶囊。
</p>

<CapsuleGrid {items} {loading}>
  {#snippet card(c)}
    <FavoriteButton
      capsule={c}
      onChange={(favorited) => {
        if (!favorited) items = items.filter((x) => x.id !== c.id);
      }}
    />
  {/snippet}
  {#snippet empty()}
    <div class="cy-empty">
      <div class="cy-empty__emoji">🗂</div>
      <p>还没有收藏任何胶囊 —— 去广场看看？</p>
      <a href="/" use:link class="cy-btn cy-btn--ghost cy-btn--sm" style:margin-top="var(--space-3)">
        去广场
      </a>
    </div>
  {/snippet}
</CapsuleGrid>

<Pagination
  {page}
  totalPages={pagination?.totalPages ?? 0}
  onChange={(p) => (page = p)}
/>
