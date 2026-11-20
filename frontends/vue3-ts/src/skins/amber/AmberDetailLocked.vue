<!-- 详情 · 封存中：进度环 + 胶囊 + 翻牌倒计时 + 元信息 -->
<script setup lang="ts">
import { computed } from "vue";
import type { CapsuleDetail } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { paletteOf } from "@/lib/palette";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import AmberBack from "./AmberBack.vue";
import AmberBadge from "./AmberBadge.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
import AmberCountdown from "./AmberCountdown.vue";
import AmberDetailActions from "./AmberDetailActions.vue";
import AmberVisBadge from "./AmberVisBadge.vue";
import { dash } from "./art";

const props = defineProps<{ c: CapsuleDetail; now: number }>();
const RING_C = 2 * Math.PI * 150;
const openAt = computed(() => ms(props.c.openAt));
const createdAt = computed(() => ms(props.c.createdAt));
const pct = computed(() => Math.min(100, Math.max(0, ((props.now - createdAt.value) / (openAt.value - createdAt.value)) * 100)));
</script>

<template>
  <AmberBack />
  <section class="vault card" :style="{ '--glow': paletteOf(c.code).glow }">
    <div class="vault__dial">
      <svg class="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
        <circle class="vault__track" cx="170" cy="170" r="150" />
        <circle class="vault__arc" cx="170" cy="170" r="150" :style="{ strokeDasharray: `${((RING_C * pct) / 100).toFixed(1)} ${RING_C.toFixed(1)}` }" />
      </svg>
      <div class="vault__art"><AmberCapsuleArt :code="c.code" state="locked" :width="220" /></div>
      <div class="vault__pct">
        <b class="mono">{{ pct.toFixed(2) }}%</b>
        <span>时间已经走过</span>
      </div>
    </div>
    <div class="vault__info">
      <div class="badges">
        <AmberBadge kind="locked" icon="lock">封存中</AmberBadge>
        <AmberVisBadge :in-plaza="c.inPlaza" />
      </div>
      <h1 class="vault__title" data-testid="detail-title">{{ c.title }}</h1>
      <div class="vault__by">
        <AppAvatar :id="c.creator.avatarId" />
        来自 <b>{{ c.creator.nickname }}</b> · 封存于 {{ fmt.cn(createdAt) }}
      </div>
      <div class="vault__k">距离开启还有</div>
      <div data-testid="countdown" :data-open-at="c.openAt">
        <AmberCountdown :open-at="openAt" :now="now" />
      </div>
      <dl class="vault__meta">
        <div>
          <dt><AppIcon name="calendar" />开启时间</dt>
          <dd class="mono">{{ dash(openAt) }}</dd>
        </div>
        <div>
          <dt><AppIcon name="key" />胶囊码</dt>
          <dd class="mono">{{ c.code }}</dd>
        </div>
        <div>
          <dt><AppIcon name="heart" />在等它的人</dt>
          <dd class="mono">{{ fmt.num(c.favoriteCount) }}</dd>
        </div>
      </dl>
      <p class="tip">
        <AppIcon name="sparkle" />
        <span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span>
      </p>
      <AmberDetailActions :c="c" />
    </div>
  </section>
</template>
