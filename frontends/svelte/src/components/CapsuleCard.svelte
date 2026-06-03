<script lang="ts">
  import type { Snippet } from "svelte";
  import { link } from "svelte-routing";
  import type { CapsuleListItem } from "@/types";
  import { avatarUrl } from "@/utils/avatar";
  import { countdownTo, fmtNumber, pad2 } from "@/utils/format";
  import { createCountdown } from "@/lib/countdown.svelte.ts";
  import FavoriteButton from "./FavoriteButton.svelte";

  interface Props {
    capsule: CapsuleListItem;
    /** 点击卡片跳转的路径，默认 /capsules/:code */
    href?: string;
    showCreator?: boolean;
    hideFavorite?: boolean;
    /** 自定义右侧操作槽（替代默认的 FavoriteButton） */
    right?: Snippet<[CapsuleListItem]>;
  }

  let {
    capsule,
    href,
    showCreator = true,
    hideFavorite = false,
    right,
  }: Props = $props();

  const opened = $derived(capsule.isOpened);
  const cardHref = $derived(href ?? `/capsules/${capsule.code}`);

  // 倒计时（仅未开启卡片需要每秒刷新）
  const cd = createCountdown(() => !opened);
  const left = $derived(countdownTo(capsule.openAt, cd.now));

  const createdAtDate = $derived(
    new Date(capsule.createdAt).toLocaleDateString("zh-CN"),
  );
</script>

<article
  class={["cy-capsule", opened ? "cy-capsule--opened" : "cy-capsule--sealed"].join(" ")}
>
  <div class="cy-capsule__head">
    <span class={["cy-badge", opened ? "cy-badge--opened" : "cy-badge--sealed"].join(" ")}>
      {opened ? "已开启" : "未开启"}
    </span>
    <a
      href={cardHref}
      use:link
      class="cy-capsule__code"
      style:text-decoration="none"
    >
      {capsule.code}
    </a>
  </div>

  <a
    href={cardHref}
    use:link
    style:text-decoration="none"
    style:color="inherit"
  >
    <h3 class="cy-capsule__title">{capsule.title}</h3>
  </a>

  {#if !opened}
    <p class="cy-capsule__countdown">
      ⏳ 还剩 {fmtNumber(left.days)} 天 · {pad2(left.hours)}:{pad2(left.minutes)}:{pad2(left.seconds)}
    </p>
  {/if}
  {#if opened && capsule.contentPreview}
    <p class="cy-capsule__preview">{capsule.contentPreview}</p>
  {/if}

  <div class="cy-capsule__meta">
    {#if showCreator}
      <span class="cy-capsule__creator">
        <img src={avatarUrl(capsule.creator.avatarId)} alt="" />
        {capsule.creator.nickname}
      </span>
    {:else}
      <span style:color="var(--color-text-muted)">创建于 {createdAtDate}</span>
    {/if}
    {#if right}
      {@render right(capsule)}
    {:else if !hideFavorite}
      <FavoriteButton {capsule} />
    {/if}
  </div>
</article>
