<!-- ============================================================
     「琥珀」广场卡片：一枚专属配色的胶囊。
     状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒当场翻面。
     ============================================================ -->
<script lang="ts">
  import type { CapsuleListItem } from "@/types";
  import { fmt, ms } from "@/lib/fmt";
  import { paletteOf } from "@/lib/palette";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import FavButton from "@/components/FavButton.svelte";
  import AmberBadge from "./AmberBadge.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import { cdShort, preview } from "./art";

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
  /** 刚到点，等列表刷新回来之前先翻面 */
  const flipping = $derived(!c.isOpened && openAt <= now);
</script>

<article
  class={["pc", opened ? "is-opened" : "is-locked", flipping && "is-flipping"]}
  style:--glow={paletteOf(c.code).glow}
  style:--i={i}
  data-testid={testId}
  data-code={c.code}
  data-state={opened ? "opened" : "sealed"}
  data-in-plaza={c.inPlaza}
>
  <a class="pc__link" href={`/capsules/${c.code}`} aria-label={`${c.title}，${opened ? "已开启" : "封存中"}`} data-testid={openTestId}></a>
  <div class="pc__top">
    <div class="pc__art"><AmberCapsuleArt code={c.code} state={opened ? "opened" : "locked"} width={150} /></div>
    <div class="pc__badges">
      {#if opened}
        <AmberBadge kind="opened" icon="mail">已开启</AmberBadge>
      {:else}
        <AmberBadge kind="locked" icon="lock">封存中</AmberBadge>
      {/if}
      {#if rank}<AmberBadge kind="hot" icon="fire">热度 No.{rank}</AmberBadge>{/if}
      {#if !c.inPlaza}<AmberBadge kind="private" icon="lock">未公开</AmberBadge>{/if}
    </div>
  </div>
  <h3 class="pc__title" data-testid="card-title">{c.title}</h3>
  <div class="pc__by">
    <AppAvatar id={c.creator.avatarId} />
    <span class="pc__name">{c.creator.nickname}</span>
    {#if mine}<em class="me-tag">我</em>{/if}
    <i></i>
    封存于 {fmt.date(createdAt)}
  </div>
  <div class="pc__body">
    {#if opened}
      <p class="pc__excerpt">{preview(c.contentPreview)}</p>
    {:else}
      <div class="pc__cd">
        <AppIcon name="hourglass" />
        <span class="pc__time mono">{cdShort(openAt, now)}</span>后开启
      </div>
      <div class="pc__progress" title="从封存到开启，时间已经走过的比例">
        <span style:width={`${Math.max(2, fmt.progress(createdAt, openAt, now))}%`}></span>
      </div>
    {/if}
  </div>
  <div class="pc__foot">
    <span class="pc__when">
      <AppIcon name="calendar" />
      {fmt.dateTime(openAt)} {opened ? "已开启" : "开启"}
    </span>
    <FavButton capsule={c} onchange={onfavchange} />
  </div>
</article>
