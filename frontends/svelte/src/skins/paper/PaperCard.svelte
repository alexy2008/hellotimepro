<!-- ============================================================
     「时笺」胶囊卡片：同一只信封的两种状态
     未开启 —— 合着、舌尖钤朱印，正文被模糊遮住，下面是等待进度的刻度尺
     已开启 —— 封舌掀起、信纸露出半截，两行正文预览
     ============================================================ -->
<script lang="ts">
  import type { CapsuleListItem } from "@/types";
  import { fmt, ms } from "@/lib/fmt";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import FavButton from "@/components/FavButton.svelte";
  import PaperCdShort from "./PaperCdShort.svelte";
  import PaperScale from "./PaperScale.svelte";
  import PaperSeal from "./PaperSeal.svelte";
  import { preview } from "./art";

  interface Props {
    c: CapsuleListItem;
    now: number;
    i?: number;
    rank?: number;
    mine?: boolean;
    /** 「我收藏的」里用 fav-item / row-open（spec/ui/testids.md §3.7） */
    testId?: string;
    openTestId?: string;
    onfavchange?: (favorited: boolean, count: number) => void;
  }
  let { c, now, i = 0, rank = 0, mine = false, testId = "capsule-card", openTestId = "card-open", onfavchange }: Props = $props();

  const openAt = $derived(ms(c.openAt));
  const createdAt = $derived(ms(c.createdAt));
  const opened = $derived(c.isOpened || openAt <= now);
</script>

<article
  class={["cap", opened ? "cap--opened" : "cap--sealed"]}
  style:--i={i}
  data-testid={testId}
  data-code={c.code}
  data-state={opened ? "opened" : "sealed"}
  data-in-plaza={c.inPlaza}
>
  <div class="cap__bg" aria-hidden="true">
    {#if opened}
      <svg class="cap__art" viewBox="0 0 120 100" aria-hidden="true">
        <path class="ea__body" d="M2 42 60 4 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
        <rect class="ea__paper" x="16" y="14" width="88" height="62" rx="1.5" />
        <path class="ea__rule" d="M26 30h68M26 40h68M26 50h68M26 60h44" />
        <path class="ea__pocket" d="M2 42 60 78 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
        <path class="ea__line" d="M2.5 97.5 49 70M117.5 97.5 71 70" />
      </svg>
    {:else}
      <svg class="cap__art" viewBox="0 0 120 84" aria-hidden="true">
        <rect class="ea__body" x="2" y="6" width="116" height="76" rx="3" />
        <path class="ea__line" d="M2.5 80.5 47 46M117.5 80.5 73 46" />
        <path class="ea__flap" d="M3 7.5 60 48 117 7.5" />
        <g class="ea__seal">
          <circle cx="60" cy="48" r="11" />
          <circle class="ea__seal-ring" cx="60" cy="48" r="7" />
        </g>
      </svg>
    {/if}
  </div>
  <a class="cap__link" href={`/capsules/${c.code}`} aria-label={`${c.title}，${opened ? "已开启" : "未开启"}`} data-testid={openTestId}></a>
  <header class="cap__top">
    <PaperSeal ch={opened ? "启" : "封"} variant={opened ? "line" : "solid"} />
    <span class="cap__status">{opened ? "已开启" : "未开启"}</span>
    {#if !c.inPlaza}<span class="cap__private" title="没有发布到广场，凭胶囊码可见"><AppIcon name="lock" />未公开</span>{/if}
    {#if rank}<span class="cap__rank latin" title={`热度第 ${rank}`}>No.{rank}</span>{/if}
    <span class="cap__code mono">{c.code}</span>
  </header>
  <h3 class="cap__title" data-testid="card-title">{c.title}</h3>
  {#if opened}
    <p class="cap__preview">{preview(c.contentPreview)}</p>
    <div class="cap__when">
      <span>启于 {fmt.date(openAt)}</span>
      <i></i>
      <span>在途 {fmt.span(openAt - createdAt)}</span>
    </div>
  {:else}
    <div class="cap__veil" aria-hidden="true"><i></i><i></i></div>
    <div class="cap__cd">
      <span class="cap__cd-label">距启封</span>
      <span class="cap__cd-val"><PaperCdShort {openAt} {now} /></span>
    </div>
    <PaperScale p={fmt.progress(createdAt, openAt, now)} />
    <div class="cap__ends mono">
      <span>{fmt.date(createdAt)}</span>
      <span>{fmt.date(openAt)}</span>
    </div>
  {/if}
  <footer class="cap__foot">
    <span class="who">
      <AppAvatar id={c.creator.avatarId} />
      <span class="who__n">{c.creator.nickname}</span>
      {#if mine}<em class="who__me">我</em>{/if}
    </span>
    <FavButton capsule={c} onchange={onfavchange} />
  </footer>
</article>
