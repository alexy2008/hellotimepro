<!-- 详情 · 未启封：信封 + 翻页倒计时 + 刻度尺。opening 不为空时信封在播启封动画 -->
<script lang="ts">
  import type { CapsuleDetail } from "@/types";
  import { fmt, ms, pad2 } from "@/lib/fmt";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import PaperBack from "./PaperBack.svelte";
  import PaperDetailActions from "./PaperDetailActions.svelte";
  import PaperEnvelope from "./PaperEnvelope.svelte";
  import PaperFlipDigits from "./PaperFlipDigits.svelte";
  import PaperPostmark from "./PaperPostmark.svelte";
  import PaperScale from "./PaperScale.svelte";
  import PaperSeal from "./PaperSeal.svelte";
  import PaperVisTag from "./PaperVisTag.svelte";
  import type { Opening } from "./art";

  let { c, now, opening }: { c: CapsuleDetail; now: number; opening: Opening | null } = $props();

  const openAt = $derived(ms(c.openAt));
  const createdAt = $derived(ms(c.createdAt));
  const cd = $derived(fmt.cd(openAt, now));
  const p = $derived(fmt.progress(createdAt, openAt, now));
  const units = $derived([
    { v: cd.d > 99 ? String(cd.d) : pad2(cd.d), lab: "天" },
    { v: pad2(cd.h), lab: "时" },
    { v: pad2(cd.m), lab: "分" },
    { v: pad2(cd.s), lab: "秒" },
  ]);
  const envCls = $derived(["env--stage", opening?.open && "is-open", opening?.rising && "is-rising"].filter(Boolean).join(" "));
</script>

<PaperBack />
<header class="detail__head">
  <div class="detail__meta">
    <span class="mono">NO. {c.code}</span>
    <PaperVisTag inPlaza={c.inPlaza} />
    <span class="tag tag--seal"><PaperSeal ch="封" />未开启</span>
  </div>
  <h1 class="detail__title" data-testid="detail-title">{c.title}</h1>
  <div class="detail__by">
    <AppAvatar id={c.creator.avatarId} />
    <b>{c.creator.nickname}</b>
    <span>封存于 {fmt.cn(createdAt)} {fmt.time(createdAt)}</span>
  </div>
</header>

<section class="stage">
  <div class="stage__pm">
    <PaperPostmark line1={fmt.date(openAt)} line2={`${fmt.time(openAt)} 启`} class="pm--stage" />
  </div>
  <PaperEnvelope class={envCls} crack={opening?.crack ?? "whole"}>
    <b>{c.title}</b><i></i><i></i><i></i><i></i>
  </PaperEnvelope>
  <div class="stage__floor"></div>
</section>

<section
  class="cd"
  aria-live="off"
  role="timer"
  data-testid="countdown"
  data-open-at={c.openAt}
  aria-label={`距离启封还有 ${cd.d} 天 ${cd.h} 小时 ${cd.m} 分 ${cd.s} 秒`}
>
  <div class="cd__label">{opening ? "时间到了，正在启封…" : "距离启封还有"}</div>
  <div class="cd__digits">
    {#each units as u, i (u.lab)}
      {#if i}<i class="cd__sep">:</i>{/if}
      <div class="cd__unit">
        <span class="cd__num latin"><PaperFlipDigits value={u.v} /></span>
        <span class="cd__lab">{u.lab}</span>
      </div>
    {/each}
  </div>
  <div class="cd__when">将于 <b>{fmt.full(openAt)}</b> 启封</div>
</section>

<section class="journey">
  <div class="journey__row">
    <span><em>封存</em>{fmt.date(createdAt)}</span>
    <span class="journey__pct">已等待 {p}%</span>
    <span><em>启封</em>{fmt.date(openAt)}</span>
  </div>
  <PaperScale {p} class="scale--lg" />
</section>

<PaperDetailActions {c} />
<p class="note">
  <AppIcon name="info" />
  <span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span>
</p>
