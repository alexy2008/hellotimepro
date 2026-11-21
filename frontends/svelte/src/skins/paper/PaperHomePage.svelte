<!-- ============================================================
     「时笺」首页 = 胶囊广场（/）
     Hero（写一枚 + 逛广场 + 就地输码 + 此刻）+ 年鉴 + 工具条 + 信封卡片网格 + 分页
     结构与类名照 2.0 原型 paper/view-plaza.js
     筛选、搜索词、页码在 plaza store 里，切皮肤、进出详情页都还在
     ============================================================ -->
<script lang="ts">
  import { fmt } from "@/lib/fmt";
  import { slashFocus } from "@/lib/attach";
  import { plaza } from "@/stores/plaza.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { isMine, onSearchKey, pageNumbers, rankOf, scrollToPlaza } from "@/state/plaza-home.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import SegControl from "@/components/SegControl.svelte";
  import type { PlazaFilter, PlazaSort } from "@/types";
  import type { SegOption } from "@/components/seg";
  import PaperAlmanacCell from "./PaperAlmanacCell.svelte";
  import PaperCard from "./PaperCard.svelte";
  import PaperCardSkeleton from "./PaperCardSkeleton.svelte";
  import PaperEmptyArt from "./PaperEmptyArt.svelte";
  import PaperHero from "./PaperHero.svelte";

  const sortOptions: SegOption<PlazaSort>[] = [
    { value: "new", label: "最新", icon: "clock" },
    { value: "hot", label: "最热", icon: "fire" },
  ];
  const filterOptions = $derived<SegOption<PlazaFilter>[]>([
    { value: "all", label: "全部", count: plaza.counts?.all },
    { value: "unopened", label: "未开启", count: plaza.counts?.unopened },
    { value: "opened", label: "已开启", count: plaza.counts?.opened },
  ]);

  const p = $derived(plaza.pagination);
  const term = $derived(plaza.q.trim());
  let search = $state<HTMLInputElement>();

  const goPage = (n: number) => {
    plaza.setPage(n);
    scrollToPlaza();
  };
  function clearSearch() {
    plaza.setQ("");
    search?.focus();
  }
</script>

<div class="page page--plaza">
  <PaperHero now={clock.now} featured={plaza.featured} />

  <section class="wrap almanac" aria-label="广场概览" data-testid="plaza-stats">
    {#if plaza.overview}
      {@const o = plaza.overview}
      <PaperAlmanacCell k="all" n={o.counts.all} a="枚胶囊" b="在广场上" />
      <PaperAlmanacCell k="unopened" n={o.counts.unopened} a="枚正在" b="等待启封" />
      <PaperAlmanacCell k="opened" n={o.counts.opened} a="枚已经" b="被人读到" />
      {#if o.farthestOpenAt}
        <PaperAlmanacCell k="farthestYear" n={new Date(o.farthestOpenAt).getFullYear()} a="年，最远的" b="一枚才会打开" plain />
      {/if}
    {/if}
  </section>

  <section id="plaza" class="wrap plaza">
    <header class="plaza__head">
      <div>
        <div class="overline"><i></i>Plaza</div>
        <h2 class="h2">胶囊广场</h2>
      </div>
      <p class="plaza__sub">
        别人写给未来的话。
        <br />
        有的已经启封，有的还在路上。
      </p>
    </header>

    <div class="toolbar">
      <SegControl bind:value={() => plaza.sort, (v) => plaza.setSort(v)} label="排序" testid="sort-option" options={sortOptions} />
      <SegControl bind:value={() => plaza.filter, (v) => plaza.setFilter(v)} label="筛选" testid="filter-option" options={filterOptions} />
      <label class={["search", plaza.qInput && "has-value"]}>
        <AppIcon name="search" />
        <input
          bind:this={search}
          bind:value={() => plaza.qInput, (v) => plaza.typeQ(v)}
          type="search"
          placeholder="搜索标题或昵称"
          maxlength="50"
          autocomplete="off"
          aria-label="搜索胶囊"
          data-testid="plaza-search"
          onkeydown={onSearchKey}
          {@attach slashFocus}
        />
        <kbd>/</kbd>
        <button class="search__x" type="button" aria-label="清空搜索" onclick={clearSearch}><AppIcon name="x" /></button>
      </label>
    </div>

    <div class={["grid", plaza.loading && p && "is-busy"]} aria-live="polite">
      {#if plaza.loading && !p}
        {#each { length: 6 }, i (i)}<PaperCardSkeleton {i} />{/each}
      {:else if plaza.error}
        <div class="empty" data-testid="list-error">
          <PaperEmptyArt />
          <h3>广场暂时打不开</h3>
          <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
          <button class="btn btn--ghost" type="button" data-testid="list-retry" onclick={() => plaza.refreshAll()}>
            <AppIcon name="refresh" />
            重试
          </button>
        </div>
      {:else if !plaza.items.length && p}
        {#if term}
          <div class="empty" data-testid="list-empty">
            <PaperEmptyArt />
            <h3>没有找到「{term}」</h3>
            <p>换个关键词试试，标题和昵称都可以搜。</p>
            <button class="btn btn--ghost" type="button" onclick={clearSearch}>清空搜索</button>
          </div>
        {:else}
          <div class="empty" data-testid="list-empty">
            <PaperEmptyArt />
            <h3>广场上还没有胶囊</h3>
            <p>来当第一个写信给未来的人？</p>
            <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
          </div>
        {/if}
      {:else}
        {#each plaza.items as c, i (c.id)}
          <PaperCard {c} {i} rank={rankOf(i)} mine={isMine(c.creator.nickname)} now={clock.now} />
        {/each}
      {/if}
    </div>

    <nav class="pager" aria-label="分页">
      {#if p && plaza.items.length}
        {#if p.totalPages <= 1}
          <div class="pager__sum">共 {fmt.num(p.total)} 枚</div>
        {:else}
          <button class="pager__nav" type="button" disabled={p.page <= 1} onclick={() => goPage(p.page - 1)}>
            <AppIcon name="chev-left" />
            上一页
          </button>
          <div class="pager__nums">
            {#each pageNumbers(p.page, p.totalPages) as n, i (n === "…" ? `g${i}` : n)}
              {#if n === "…"}
                <span class="pager__gap">…</span>
              {:else}
                <button
                  class={["pager__n", "latin", n === p.page && "is-active"]}
                  type="button"
                  aria-current={n === p.page ? "page" : undefined}
                  onclick={() => goPage(n)}
                >
                  {n}
                </button>
              {/if}
            {/each}
          </div>
          <button
            class="pager__nav"
            type="button"
            disabled={p.page >= p.totalPages}
            data-testid={p.page < p.totalPages ? "plaza-next" : undefined}
            onclick={() => goPage(p.page + 1)}
          >
            下一页
            <AppIcon name="chev-right" />
          </button>
          <div class="pager__sum">共 {fmt.num(p.total)} 枚 · 第 {p.page} / {p.totalPages} 页</div>
        {/if}
      {/if}
    </nav>
  </section>
</div>
