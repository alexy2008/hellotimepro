<!-- 「我创建的」：一本账簿，每行一枚胶囊（含删除） -->
<script lang="ts">
  import type { CapsuleListItem } from "@/types";
  import { fmt, ms, pad2 } from "@/lib/fmt";
  import { share } from "@/stores/feedback.svelte.ts";
  import { MyList } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import ListMore from "@/components/ListMore.svelte";
  import PaperScale from "./PaperScale.svelte";
  import PaperSeal from "./PaperSeal.svelte";
  import PaperDlgMark from "./PaperDlgMark.svelte";

  let { now, onchange }: { now: number; onchange: () => void } = $props();
  const list = new MyList("created", () => onchange());

  const row = (c: CapsuleListItem) => {
    const openAt = ms(c.openAt);
    const createdAt = ms(c.createdAt);
    return { openAt, createdAt, opened: c.isOpened || openAt <= now, cd: fmt.cd(openAt, now) };
  };
  /** 删除确认框顶上盖一枚「删」字朱文印 */
  const mark = { component: PaperDlgMark, props: { ch: "删" } };
</script>

{#if list.items}
  {#if !list.items.length}
    <div class="empty empty--inline" data-testid="list-empty">
      <PaperSeal ch="空" variant="line" />
      <h3>还没有写下任何胶囊</h3>
      <p>第一封信，写给一年后的自己怎么样？</p>
      <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
    </div>
  {:else}
    <div class="me__bar">
      <span>按创建时间倒序 · 共 {list.total} 枚</span>
      <CreateLink class="btn btn--primary btn--sm"><AppIcon name="plus" />新建胶囊</CreateLink>
    </div>
    <ul class="ledger">
      {#each list.items as c, i (c.id)}
        {@const r = row(c)}
        <li class="ledger__row" style:--i={i} data-testid="my-capsule" data-code={c.code} data-state={r.opened ? "opened" : "sealed"} data-in-plaza={c.inPlaza}>
          <div class="ledger__seal">
            <PaperSeal ch={r.opened ? "启" : "封"} variant={r.opened ? "line" : "solid"} />
          </div>
          <div class="ledger__main">
            <a class="ledger__title serif" href={`/capsules/${c.code}`} data-testid="row-open">{c.title}</a>
            <div class="ledger__sub">
              <button class="ledger__code mono" type="button" title="点击复制胶囊码" onclick={() => share.code(c.code)}>{c.code}<AppIcon name="copy" /></button>
              {#if c.inPlaza}
                <span class="tag"><AppIcon name="globe" />广场公开</span>
              {:else}
                <span class="tag tag--quiet"><AppIcon name="lock" />仅凭码可见</span>
              {/if}
              <span>封存于 {fmt.date(r.createdAt)}</span>
            </div>
          </div>
          {#if r.opened}
            <div class="ledger__when">
              <span class="ledger__k">已启封</span>
              <b>{fmt.date(r.openAt)}</b>
              <small>在途 {fmt.span(r.openAt - r.createdAt)}</small>
            </div>
          {:else}
            <div class="ledger__when">
              <span class="ledger__k">距启封</span>
              <b>
                {#if r.cd.d > 0}<span class="latin">{fmt.num(r.cd.d)}</span> 天{:else}<span class="mono">{pad2(r.cd.h)}:{pad2(r.cd.m)}:{pad2(r.cd.s)}</span>{/if}
              </b>
              <PaperScale p={fmt.progress(r.createdAt, r.openAt, now)} />
            </div>
          {/if}
          <div class="ledger__fav" title={`被收藏 ${c.favoriteCount} 次`}>
            <AppIcon name="heart" />
            <span class="latin">{fmt.num(c.favoriteCount)}</span>
          </div>
          <div class="ledger__act">
            <a class="btn btn--text" href={`/capsules/${c.code}`}>查看</a>
            <button class="btn btn--text btn--danger" type="button" data-testid="delete-capsule" onclick={() => list.remove(c, mark)}>删除</button>
          </div>
        </li>
      {/each}
    </ul>
    <ListMore show={list.hasMore} busy={list.moreBusy} left={list.total - list.items.length} onmore={list.loadMore} />
    <p class="me__fine">
      <AppIcon name="info" />
      胶囊的内容与启封时刻一经封存就不可修改；你可以随时删除自己写的胶囊，无论它是否已经启封。
    </p>
  {/if}
{/if}
