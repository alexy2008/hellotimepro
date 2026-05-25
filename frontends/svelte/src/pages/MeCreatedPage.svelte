<script lang="ts">
  import { link } from "svelte-routing";
  import { api } from "@/api/client";
  import type { CapsuleListItem, Pagination as PaginationT } from "@/types";
  import CapsuleGrid from "@/components/CapsuleGrid.svelte";
  import Pagination from "@/components/Pagination.svelte";
  import { fmtNumber } from "@/utils/format";

  const PAGE_SIZE = 15;

  let items = $state<CapsuleListItem[]>([]);
  let pagination = $state<PaginationT | null>(null);
  let page = $state(1);
  let loading = $state(true);

  async function load() {
    loading = true;
    try {
      const r = await api.myCapsules(page, PAGE_SIZE);
      items = r.items;
      pagination = r.pagination;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // 触发：page 变化时 reload
    page;
    void load();
  });

  async function withdraw(id: string) {
    const sure = window.confirm("确认撤回？此操作不可恢复。");
    if (!sure) return;
    try {
      await api.deleteMyCapsule(id);
      items = items.filter((c) => c.id !== id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "撤回失败");
    }
  }
</script>

<h1>我创建的胶囊</h1>

<div class="cy-toolbar" style:border-bottom="none" style:padding-top="0">
  <span style:color="var(--color-text-muted)" style:font-size="var(--font-size-sm)">
    按创建时间倒序 · 共 {pagination?.total ?? 0} 条
  </span>
  <a href="/create" use:link class="cy-btn cy-btn--primary cy-btn--sm">+ 新建胶囊</a>
</div>

<CapsuleGrid
  {items}
  {loading}
  showCreator={false}
  hideFavorite
>
  {#snippet empty()}
    <div class="cy-empty">
      <div class="cy-empty__emoji">📭</div>
      <p>还没有创建任何胶囊</p>
      <a href="/create" use:link class="cy-btn cy-btn--primary cy-btn--sm" style:margin-top="var(--space-3)">
        去创建一个
      </a>
    </div>
  {/snippet}
  {#snippet card(c)}
    <div style:display="flex" style:align-items="center" style:gap="var(--space-2)">
      {#if c.isOpened}
        <span style:color="var(--color-favorite-active)" style:font-size="var(--font-size-sm)">
          ♥ {fmtNumber(c.favoriteCount)}
        </span>
      {/if}
      <button
        type="button"
        class="cy-btn cy-btn--ghost cy-btn--sm"
        style:min-height="28px"
        style:padding="4px 12px"
        style:color="var(--color-danger-fg)"
        onclick={() => withdraw(c.id)}
      >
        {c.isOpened ? "删除" : "撤回"}
      </button>
    </div>
  {/snippet}
</CapsuleGrid>

<Pagination
  {page}
  totalPages={pagination?.totalPages ?? 0}
  onChange={(p) => (page = p)}
/>
