<!-- ============================================================
     「琥珀」首页 = 主视觉 + 年鉴 + 胶囊广场（/）
     主视觉：「把此刻，寄给未来。」+ 两个入口 + 就地输码 + 时间表盘 + 精选凭条
     结构与类名照 2.0 原型 amber/view-plaza.js
     筛选、搜索词、页码在 plaza store 里，切皮肤、进出详情页都还在
     ============================================================ -->
<script lang="ts">
  import { fmt, ms } from "@/lib/fmt";
  import { paletteOf } from "@/lib/palette";
  import { slashFocus } from "@/lib/attach";
  import { plaza } from "@/stores/plaza.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { isMine, onSearchKey, pageNumbers, rankOf, scrollToPlaza } from "@/state/plaza-home.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import SegControl from "@/components/SegControl.svelte";
  import type { PlazaFilter, PlazaSort } from "@/types";
  import type { SegOption } from "@/components/seg";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberCard from "./AmberCard.svelte";
  import AmberCardSkeleton from "./AmberCardSkeleton.svelte";
  import AmberEmpty from "./AmberEmpty.svelte";
  import AmberHeroArt from "./AmberHeroArt.svelte";
  import AmberQuickOpen from "./AmberQuickOpen.svelte";
  import { cdShort } from "./art";

  const now = $derived(clock.now);
  const filterOptions = $derived<SegOption<PlazaFilter>[]>([
    { value: "all", label: "全部", count: plaza.counts?.all },
    { value: "unopened", label: "封存中", count: plaza.counts?.unopened },
    { value: "opened", label: "已开启", count: plaza.counts?.opened },
  ]);
  const stats = $derived.by(() => {
    const s = plaza.overview;
    if (!s) return [];
    const out = [
      { k: "all", n: s.counts.all, a: "枚胶囊", b: "在广场上" },
      { k: "unopened", n: s.counts.unopened, a: "枚正在", b: "等待开启" },
      { k: "opened", n: s.counts.opened, a: "枚已经", b: "被人读到" },
    ];
    if (s.farthestOpenAt) out.push({ k: "farthestYear", n: new Date(s.farthestOpenAt).getFullYear(), a: "年，最远的", b: "一枚才会打开" });
    return out;
  });

  const p = $derived(plaza.pagination);
  const f = $derived(plaza.featured);
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

<div class="page page--home">
  <section class="hero container">
    <div class="hero__copy">
      <div class="eyebrow">HelloTime Pro · 时间胶囊</div>
      <h1 class="hero__title">
        <span class="hero__line">把此刻，</span>
        <span class="hero__line">寄给<em class="hero__future">未来</em>。</span>
      </h1>
      <p class="hero__lede">
        写下一段话，选定一个未来的时刻，把它封进胶囊。
        <br />
        在那之前，谁也读不到——包括你自己。
      </p>
      <div class="hero__cta">
        <CreateLink class="btn btn--primary btn--lg" data-testid="home-create"><AppIcon name="pen" />写一枚胶囊</CreateLink>
        <a class="btn btn--ghost btn--lg" href="#plaza" onclick={scrollToPlaza}>逛逛胶囊广场<AppIcon name="arrow" class="ic--go" /></a>
      </div>
      <AmberQuickOpen />
      <div class="hero__now">
        <span class="hero__live"></span>
        此刻 · <span class="mono">{fmt.date(now).replace(/\./g, "-")} {fmt.time(now, true)}</span>
      </div>
    </div>
    <div class="hero__art">
      <AmberHeroArt />
      {#if f}
        <a class="slip" href={`/capsules/${f.code}`} style:--glow={paletteOf(f.code).glow}>
          <div class="slip__k"><span class="slip__dot"></span>广场上最受期待的一枚</div>
          <div class="slip__row">
            <AmberCapsuleArt code={f.code} state="locked" width={64} />
            <div>
              <b class="slip__t">{f.title}</b>
              <span class="slip__cd mono">{cdShort(ms(f.openAt), now)}</span>
            </div>
          </div>
          <div class="slip__f"><AppIcon name="heart" />{fmt.num(f.favoriteCount)} 人在等它</div>
        </a>
      {/if}
    </div>
  </section>

  <section class="container stats" aria-label="广场概览" data-testid="plaza-stats">
    {#each stats as s, i (s.k)}
      <div class="stats__cell" style:--i={i} data-testid="stat" data-key={s.k} data-value={s.n}>
        <b class="mono">{s.n}</b>
        <span>{s.a}<br />{s.b}</span>
      </div>
    {/each}
  </section>

  <section id="plaza" class="container plaza">
    <header class="page-head page-head--split">
      <div>
        <div class="eyebrow">Capsule Plaza</div>
        <h2 class="page-title">胶囊广场</h2>
        <p class="page-lead">这里陈列着愿意被看见的胶囊。封存中的只露出标题与倒计时；时间到了，才会交出里面的话。</p>
      </div>
      <CreateLink class="btn btn--primary"><AppIcon name="pen" />我也放一枚</CreateLink>
    </header>

    <div class="toolbar card">
      <label class={["search", "input-wrap", plaza.qInput && "has-value"]}>
        <AppIcon name="search" class="input-wrap__icon" />
        <input
          bind:this={search}
          bind:value={() => plaza.qInput, (v) => plaza.typeQ(v)}
          class="input"
          type="search"
          placeholder="搜索标题或昵称…"
          maxlength="50"
          autocomplete="off"
          aria-label="搜索胶囊"
          data-testid="plaza-search"
          onkeydown={onSearchKey}
          {@attach slashFocus}
        />
        <kbd class="kbd">/</kbd>
        <button class="search__x icon-btn" type="button" aria-label="清空搜索" onclick={clearSearch}><AppIcon name="x" /></button>
      </label>
      <SegControl bind:value={() => plaza.filter, (v) => plaza.setFilter(v)} label="筛选" testid="filter-option" options={filterOptions} />
      <div class="select">
        <select bind:value={() => plaza.sort, (v: PlazaSort) => plaza.setSort(v)} aria-label="排序" data-testid="plaza-sort">
          <option value="new">最新封存</option>
          <option value="hot">最多收藏</option>
        </select>
        <AppIcon name="chev-down" class="select__arrow" />
      </div>
    </div>

    <div class="plaza__count">
      {#if p}共 <b>{fmt.num(p.total)}</b> 枚胶囊{term ? ` · 关键词「${term}」` : ""}{/if}
    </div>

    <div class={["grid", plaza.loading && p && "is-busy"]} aria-live="polite">
      {#if plaza.loading && !p}
        {#each { length: 6 }, i (i)}<AmberCardSkeleton {i} />{/each}
      {:else if plaza.error}
        <AmberEmpty testid="list-error" title="广场暂时打不开" text="没能连上后端。请确认服务已启动，或稍后再试。">
          <button class="btn btn--ghost" type="button" data-testid="list-retry" onclick={() => plaza.refreshAll()}><AppIcon name="refresh" />重试</button>
        </AmberEmpty>
      {:else if !plaza.items.length && p}
        {#if term}
          <AmberEmpty title={`没有找到「${term}」`} text="换个关键词试试，标题和昵称都可以搜。">
            <button class="btn btn--ghost" type="button" onclick={clearSearch}>清空搜索</button>
          </AmberEmpty>
        {:else}
          <AmberEmpty title="广场上还没有胶囊" text="来当第一个写信给未来的人？">
            <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
          </AmberEmpty>
        {/if}
      {:else}
        {#each plaza.items as c, i (c.id)}
          <AmberCard {c} {i} rank={rankOf(i)} mine={isMine(c.creator.nickname)} {now} />
        {/each}
      {/if}
    </div>

    <nav class="pager" aria-label="分页">
      {#if p && p.totalPages > 1 && plaza.items.length}
        <button class="pager__btn" type="button" disabled={p.page <= 1} aria-label="上一页" onclick={() => goPage(p.page - 1)}>
          <AppIcon name="chev-left" />
        </button>
        {#each pageNumbers(p.page, p.totalPages) as n, i (n === "…" ? `g${i}` : n)}
          {#if n === "…"}
            <span class="pager__gap">…</span>
          {:else}
            <button class={["pager__btn", n === p.page && "is-active"]} type="button" aria-current={n === p.page ? "page" : undefined} onclick={() => goPage(n)}>
              {n}
            </button>
          {/if}
        {/each}
        <button
          class="pager__btn"
          type="button"
          disabled={p.page >= p.totalPages}
          aria-label="下一页"
          data-testid={p.page < p.totalPages ? "plaza-next" : undefined}
          onclick={() => goPage(p.page + 1)}
        >
          <AppIcon name="chev-right" />
        </button>
      {/if}
    </nav>
  </section>
</div>
