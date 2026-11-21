<!-- 「我收藏的」：胶囊卡片网格；在这里取消收藏会从列表里拿掉 -->
<script lang="ts">
  import { authStore } from "@/stores/auth.svelte.ts";
  import type { MyList } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import ListMore from "@/components/ListMore.svelte";
  import AmberCard from "./AmberCard.svelte";
  import AmberEmpty from "./AmberEmpty.svelte";

  let { now, list }: { now: number; list: MyList } = $props();
</script>

{#if list.error}
  <div class="notice card" role="alert">
    <p>暂时无法加载我收藏的胶囊。</p>
    <button class="btn btn--ghost" type="button" onclick={list.reload}>重试</button>
  </div>
{:else if list.items}
  {#if !list.items.length}
    <AmberEmpty state="locked" title="还没有收藏" text="去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。">
      <a class="btn btn--primary" href="/">去广场逛逛<AppIcon name="arrow" /></a>
    </AmberEmpty>
  {:else}
    <div class="me__sub">
      <span>按收藏时间倒序 · 共 {list.total} 枚</span>
      <a class="btn btn--ghost btn--sm" href="/">去广场逛逛</a>
    </div>
    <div class="grid">
      {#each list.items as c, i (c.id)}
        <AmberCard
          {c}
          {i}
          {now}
          mine={authStore.user?.nickname === c.creator.nickname}
          testId="fav-item"
          openTestId="row-open"
          onfavchange={(f) => list.onFavChange(c.id, f)}
        />
      {/each}
    </div>
    <ListMore show={list.hasMore} busy={list.moreBusy} left={list.total - list.items.length} onmore={list.loadMore} />
  {/if}
{/if}
