<!-- 详情 · 封存中：进度环 + 胶囊 + 翻牌倒计时 + 元信息 -->
<script lang="ts">
  import type { CapsuleDetail } from "@/types";
  import { fmt, ms } from "@/lib/fmt";
  import { paletteOf } from "@/lib/palette";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import AmberBack from "./AmberBack.svelte";
  import AmberBadge from "./AmberBadge.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberCountdown from "./AmberCountdown.svelte";
  import AmberDetailActions from "./AmberDetailActions.svelte";
  import AmberVisBadge from "./AmberVisBadge.svelte";
  import { dash } from "./art";

  let { c, now }: { c: CapsuleDetail; now: number } = $props();
  const RING_C = 2 * Math.PI * 150;
  const openAt = $derived(ms(c.openAt));
  const createdAt = $derived(ms(c.createdAt));
  const pct = $derived(Math.min(100, Math.max(0, ((now - createdAt) / (openAt - createdAt)) * 100)));
</script>

<AmberBack />
<section class="vault card" style:--glow={paletteOf(c.code).glow}>
  <div class="vault__dial">
    <svg class="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
      <circle class="vault__track" cx="170" cy="170" r="150" />
      <circle class="vault__arc" cx="170" cy="170" r="150" style:stroke-dasharray={`${((RING_C * pct) / 100).toFixed(1)} ${RING_C.toFixed(1)}`} />
    </svg>
    <div class="vault__art"><AmberCapsuleArt code={c.code} state="locked" width={220} /></div>
    <div class="vault__pct">
      <b class="mono">{pct.toFixed(2)}%</b>
      <span>时间已经走过</span>
    </div>
  </div>
  <div class="vault__info">
    <div class="badges">
      <AmberBadge kind="locked" icon="lock">封存中</AmberBadge>
      <AmberVisBadge inPlaza={c.inPlaza} />
    </div>
    <h1 class="vault__title" data-testid="detail-title">{c.title}</h1>
    <div class="vault__by">
      <AppAvatar id={c.creator.avatarId} />
      来自 <b>{c.creator.nickname}</b> · 封存于 {fmt.cn(createdAt)}
    </div>
    <div class="vault__k">距离开启还有</div>
    <div data-testid="countdown" data-open-at={c.openAt}>
      <AmberCountdown {openAt} {now} />
    </div>
    <dl class="vault__meta">
      <div>
        <dt><AppIcon name="calendar" />开启时间</dt>
        <dd class="mono">{dash(openAt)}</dd>
      </div>
      <div>
        <dt><AppIcon name="key" />胶囊码</dt>
        <dd class="mono">{c.code}</dd>
      </div>
      <div>
        <dt><AppIcon name="heart" />在等它的人</dt>
        <dd class="mono">{fmt.num(c.favoriteCount)}</dd>
      </div>
    </dl>
    <p class="tip">
      <AppIcon name="sparkle" />
      <span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span>
    </p>
    <AmberDetailActions {c} />
  </div>
</section>
