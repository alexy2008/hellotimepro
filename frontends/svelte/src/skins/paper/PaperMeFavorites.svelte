<!-- 「我收藏的」：信封卡片网格；在这里取消收藏会从列表里拿掉 -->
<script lang="ts">
  import { authStore } from "@/stores/auth.svelte.ts";
  import { MyList } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import ListMore from "@/components/ListMore.svelte";
  import PaperCard from "./PaperCard.svelte";
  import PaperSeal from "./PaperSeal.svelte";

  let { now, onchange }: { now: number; onchange: () => void } = $props();
  const list = new MyList("favorites", () => onchange());
</script>

{#if list.items}
  {#if !list.items.length}
    <div class="empty empty--inline" data-testid="list-empty">
      <PaperSeal ch="藏" variant="line" />
      <h3>还没有收藏</h3>
      <p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p>
      <a class="btn btn--primary" href="/">去广场逛逛<AppIcon name="arrow" class="ic--go" /></a>
    </div>
  {:else}
    <div class="me__bar">
      <span>按收藏时间倒序 · 共 {list.total} 枚</span>
      <a class="btn btn--ghost btn--sm" href="/">去广场逛逛</a>
    </div>
    <div class="grid grid--me">
      {#each list.items as c, i (c.id)}
        <PaperCard
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
