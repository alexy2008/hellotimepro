<script lang="ts">
  import type { CapsuleDetail as CapsuleDetailT } from "@/types";
  import { avatarUrl } from "@/utils/avatar";
  import { countdownTo, fmtDateTime } from "@/utils/format";
  import { createCountdown } from "@/lib/countdown.svelte.ts";
  import FavoriteButton from "./FavoriteButton.svelte";
  import CalendarUnit from "./CalendarUnit.svelte";

  interface Props {
    capsule: CapsuleDetailT;
    onChange?: (c: CapsuleDetailT) => void;
    /** 倒计时到点后父组件需要重新拉取胶囊数据 */
    onExpired?: () => void;
  }

  let { capsule, onChange, onExpired }: Props = $props();

  const opened = $derived(capsule.isOpened);

  const cd = createCountdown(() => !opened);
  const left = $derived(countdownTo(capsule.openAt, cd.now));

  let autoOpening = $state(false);
  let expiredTimer: number | undefined;

  function clearExpiredTimer() {
    if (expiredTimer !== undefined) {
      window.clearTimeout(expiredTimer);
      expiredTimer = undefined;
    }
  }

  // 监听 (opened, openAt) 变化：到点后通知父组件刷新；如果仍未开启就 1 秒后重试
  $effect(() => {
    const isOpened = opened;
    const openAtIso = capsule.openAt;

    clearExpiredTimer();
    if (isOpened) return;

    const openAt = new Date(openAtIso).getTime();
    if (Number.isNaN(openAt)) return;

    function fire() {
      autoOpening = true;
      onExpired?.();
      // 父组件收到 expired 后会重新设置 capsule prop；
      // 如果新 prop 仍未开启，effect 会再排一次定时器。
      // 这里仅在「父组件没换 prop」时兜底重试。
      expiredTimer = window.setTimeout(() => {
        autoOpening = false;
        if (!capsule.isOpened) {
          fire();
        }
      }, 1000);
    }

    expiredTimer = window.setTimeout(
      fire,
      Math.max(0, openAt - Date.now() + 250),
    );

    return clearExpiredTimer;
  });

  let codeCopied = $state(false);
  let linkCopied = $state(false);

  function copyCode() {
    void navigator.clipboard.writeText(capsule.code);
    codeCopied = true;
    setTimeout(() => {
      codeCopied = false;
    }, 2000);
  }
  function copyLink() {
    void navigator.clipboard.writeText(window.location.href);
    linkCopied = true;
    setTimeout(() => {
      linkCopied = false;
    }, 2000);
  }

  function onFavChange(fav: boolean, count: number) {
    onChange?.({ ...capsule, favoritedByMe: fav, favoriteCount: count });
  }
</script>

<div class="cy-capsule-detail">
  <div class="cy-capsule-detail__head">
    <span class={["cy-badge", opened ? "cy-badge--opened" : "cy-badge--sealed"].join(" ")}>
      {opened ? "已开启" : "未开启"}
    </span>
    {#if capsule.inPlaza}
      <span class="cy-badge cy-badge--plaza">广场公开</span>
    {/if}
    <span class="cy-capsule__code">{capsule.code}</span>
    <span style:color="var(--color-text-muted)" style:font-size="var(--font-size-sm)">
      · 创建于 {fmtDateTime(capsule.createdAt)}
    </span>
  </div>

  <h1 class="cy-capsule-detail__title">{capsule.title}</h1>

  {#if opened && capsule.content !== null}
    <div
      style:display="flex"
      style:align-items="center"
      style:gap="var(--space-2)"
      style:margin-bottom="var(--space-4)"
      style:font-size="var(--font-size-sm)"
      style:color="var(--color-text-muted)"
    >
      <span>🔓</span>
      <span>
        开启于
        <strong style:color="var(--color-capsule-opened-accent)">
          {fmtDateTime(capsule.openAt)}
        </strong>
      </span>
    </div>
    <div class="cy-capsule-detail__content">{capsule.content}</div>
  {:else}
    <div class="cy-capsule-detail__sealed">
      <div style:font-size="var(--font-size-4xl)" style:opacity="0.7">🔒</div>
      <div
        style:color="var(--color-text-secondary)"
        style:margin-top="var(--space-3)"
        style:font-size="var(--font-size-sm)"
        style:letter-spacing="0.1em"
      >
        这封信还在上锁，将在以下时刻开启
      </div>
      <div class="cy-cal">
        <CalendarUnit value={left.days} label="天" />
        <span class="cy-cal-sep">:</span>
        <CalendarUnit value={left.hours} label="时" />
        <span class="cy-cal-sep">:</span>
        <CalendarUnit value={left.minutes} label="分" />
        <span class="cy-cal-sep">:</span>
        <CalendarUnit value={left.seconds} label="秒" />
      </div>
      <div style:color="var(--color-text-secondary)">
        {#if left.expired}
          {#if autoOpening}正在开启…{:else}正在同步开启状态…{/if}
        {:else}
          开启于
          <strong style:color="var(--color-text-primary)">
            {fmtDateTime(capsule.openAt)}
          </strong>
        {/if}
      </div>
    </div>
  {/if}

  <div
    style:margin-top="var(--space-6)"
    style:display="flex"
    style:justify-content="space-between"
    style:align-items="center"
    style:flex-wrap="wrap"
    style:gap="var(--space-3)"
  >
    <div
      style:display="flex"
      style:align-items="center"
      style:gap="var(--space-2)"
      style:color="var(--color-text-secondary)"
      style:font-size="var(--font-size-sm)"
    >
      来自
      <img
        src={avatarUrl(capsule.creator.avatarId)}
        alt=""
        style:width="32px"
        style:height="32px"
        style:border-radius="50%"
      />
      <strong style:color="var(--color-text-primary)">{capsule.creator.nickname}</strong>
    </div>
    <div style:display="flex" style:gap="var(--space-3)">
      <button type="button" class="cy-btn cy-btn--ghost" onclick={copyCode}>
        {codeCopied ? "✓ 已复制!" : "📎 复制 8 位码"}
      </button>
      <button type="button" class="cy-btn cy-btn--ghost" onclick={copyLink}>
        {linkCopied ? "✓ 已复制!" : "🔗 分享链接"}
      </button>
      <FavoriteButton {capsule} size="md" onChange={onFavChange} />
    </div>
  </div>

  {#if !opened}
    <div class="cy-alert cy-alert--info" style:margin-top="var(--space-6)">
      <span>ⓘ</span>
      <span>未开启的胶囊仅显示标题与倒计时，内容将在开启后公开到广场。</span>
    </div>
  {/if}
  {#if opened && capsule.inPlaza}
    <div class="cy-alert cy-alert--success" style:margin-top="var(--space-6)">
      <span>✓</span>
      <span>这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</span>
    </div>
  {/if}
</div>
