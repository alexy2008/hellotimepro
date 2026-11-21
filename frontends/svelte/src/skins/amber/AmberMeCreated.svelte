<!-- 「我创建的」：每行一枚专属配色的胶囊（含删除） -->
<script lang="ts">
  import type { CapsuleListItem } from "@/types";
  import { fmt, ms } from "@/lib/fmt";
  import { paletteOf } from "@/lib/palette";
  import { share } from "@/stores/feedback.svelte.ts";
  import type { MyList } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import ListMore from "@/components/ListMore.svelte";
  import AmberBadge from "./AmberBadge.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberDlgArt from "./AmberDlgArt.svelte";
  import AmberEmpty from "./AmberEmpty.svelte";
  import AmberVisBadge from "./AmberVisBadge.svelte";
  import { cdShort } from "./art";

  let { now, list }: { now: number; list: MyList } = $props();

  const row = (c: CapsuleListItem) => {
    const openAt = ms(c.openAt);
    const createdAt = ms(c.createdAt);
    return { openAt, createdAt, opened: c.isOpened || openAt <= now };
  };
</script>

{#if list.error}
  <div class="notice card" role="alert">
    <p>暂时无法加载我创建的胶囊。</p>
    <button class="btn btn--ghost" type="button" onclick={list.reload}>重试</button>
  </div>
{:else if list.items}
  {#if !list.items.length}
    <AmberEmpty title="还没有写下任何胶囊" text="第一枚，写给一年后的自己怎么样？">
      <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
    </AmberEmpty>
  {:else}
    <div class="me__sub">
      <span>按创建时间倒序 · 共 {list.total} 枚</span>
      <CreateLink class="btn btn--primary btn--sm"><AppIcon name="plus" />写一枚</CreateLink>
    </div>
    <ul class="ledger">
      {#each list.items as c, i (c.id)}
        {@const r = row(c)}
        <li
          class="ledger__row"
          style:--i={i}
          style:--glow={paletteOf(c.code).glow}
          data-testid="my-capsule"
          data-code={c.code}
          data-state={r.opened ? "opened" : "sealed"}
          data-in-plaza={c.inPlaza}
        >
          <a class="ledger__art" href={`/capsules/${c.code}`} tabindex="-1" aria-hidden="true">
            <AmberCapsuleArt code={c.code} state={r.opened ? "opened" : "locked"} width={112} />
          </a>
          <div class="ledger__main">
            <a class="ledger__title" href={`/capsules/${c.code}`} data-testid="row-open">{c.title}</a>
            <div class="ledger__sub">
              <button class="ledger__code mono" type="button" title="点击复制胶囊码" onclick={() => share.code(c.code)}>{c.code}<AppIcon name="copy" /></button>
              <AmberVisBadge inPlaza={c.inPlaza} />
              <span>封存于 {fmt.date(r.createdAt)}</span>
            </div>
          </div>
          <div class="ledger__when">
            {#if r.opened}
              <AmberBadge kind="opened" icon="mail">已开启</AmberBadge>
              <span>{fmt.date(r.openAt)} · 沉睡 {fmt.span(r.openAt - r.createdAt)}</span>
            {:else}
              <span class="ledger__cd"><AppIcon name="hourglass" /><b class="mono">{cdShort(r.openAt, now)}</b></span>
              <div class="pc__progress">
                <span style:width={`${Math.max(2, fmt.progress(r.createdAt, r.openAt, now))}%`}></span>
              </div>
            {/if}
          </div>
          <div class="ledger__fav" title={`被收藏 ${c.favoriteCount} 次`}>
            <AppIcon name="heart" />
            <span class="mono">{fmt.num(c.favoriteCount)}</span>
          </div>
          <div class="ledger__act">
            <a class="btn btn--ghost btn--sm" href={`/capsules/${c.code}`}>查看</a>
            <button
              class="btn btn--danger-ghost btn--sm"
              type="button"
              data-testid="delete-capsule"
              onclick={() => list.remove(c, { component: AmberDlgArt, props: { code: c.code } })}
            >
              删除
            </button>
          </div>
        </li>
      {/each}
    </ul>
    <ListMore show={list.hasMore} busy={list.moreBusy} left={list.total - list.items.length} onmore={list.loadMore} />
    <p class="tip tip--quiet">
      <AppIcon name="info" />
      <span>胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。</span>
    </p>
  {/if}
{/if}
