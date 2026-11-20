<!-- 详情 · 未启封：信封 + 翻页倒计时 + 刻度尺。opening 不为空时信封在播启封动画 -->
<script setup lang="ts">
import { computed } from "vue";
import type { CapsuleDetail } from "@/types";
import { fmt, ms, pad2 } from "@/lib/fmt";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import PaperBack from "./PaperBack.vue";
import PaperDetailActions from "./PaperDetailActions.vue";
import PaperEnvelope from "./PaperEnvelope.vue";
import PaperFlipDigits from "./PaperFlipDigits.vue";
import PaperPostmark from "./PaperPostmark.vue";
import PaperScale from "./PaperScale.vue";
import PaperSeal from "./PaperSeal.vue";
import PaperVisTag from "./PaperVisTag.vue";
import type { Opening } from "./art";

const props = defineProps<{ c: CapsuleDetail; now: number; opening: Opening | null }>();

const openAt = computed(() => ms(props.c.openAt));
const createdAt = computed(() => ms(props.c.createdAt));
const cd = computed(() => fmt.cd(openAt.value, props.now));
const p = computed(() => fmt.progress(createdAt.value, openAt.value, props.now));
const units = computed(() => [
  { v: cd.value.d > 99 ? String(cd.value.d) : pad2(cd.value.d), lab: "天" },
  { v: pad2(cd.value.h), lab: "时" },
  { v: pad2(cd.value.m), lab: "分" },
  { v: pad2(cd.value.s), lab: "秒" },
]);
</script>

<template>
  <PaperBack />
  <header class="detail__head">
    <div class="detail__meta">
      <span class="mono">NO. {{ c.code }}</span>
      <PaperVisTag :in-plaza="c.inPlaza" />
      <span class="tag tag--seal"><PaperSeal ch="封" />未开启</span>
    </div>
    <h1 class="detail__title" data-testid="detail-title">{{ c.title }}</h1>
    <div class="detail__by">
      <AppAvatar :id="c.creator.avatarId" />
      <b>{{ c.creator.nickname }}</b>
      <span>封存于 {{ fmt.cn(createdAt) }} {{ fmt.time(createdAt) }}</span>
    </div>
  </header>

  <section class="stage">
    <div class="stage__pm">
      <PaperPostmark :line1="fmt.date(openAt)" :line2="`${fmt.time(openAt)} 启`" class="pm--stage" />
    </div>
    <PaperEnvelope :class="['env--stage', { 'is-open': opening?.open, 'is-rising': opening?.rising }]" :crack="opening?.crack ?? 'whole'">
      <b>{{ c.title }}</b><i /><i /><i /><i />
    </PaperEnvelope>
    <div class="stage__floor" />
  </section>

  <section
    class="cd"
    aria-live="off"
    role="timer"
    data-testid="countdown"
    :data-open-at="c.openAt"
    :aria-label="`距离启封还有 ${cd.d} 天 ${cd.h} 小时 ${cd.m} 分 ${cd.s} 秒`"
  >
    <div class="cd__label">{{ opening ? "时间到了，正在启封…" : "距离启封还有" }}</div>
    <div class="cd__digits">
      <template v-for="(u, i) in units" :key="u.lab">
        <i v-if="i" class="cd__sep">:</i>
        <div class="cd__unit">
          <span class="cd__num latin"><PaperFlipDigits :value="u.v" /></span>
          <span class="cd__lab">{{ u.lab }}</span>
        </div>
      </template>
    </div>
    <div class="cd__when">将于 <b>{{ fmt.full(openAt) }}</b> 启封</div>
  </section>

  <section class="journey">
    <div class="journey__row">
      <span><em>封存</em>{{ fmt.date(createdAt) }}</span>
      <span class="journey__pct">已等待 {{ p }}%</span>
      <span><em>启封</em>{{ fmt.date(openAt) }}</span>
    </div>
    <PaperScale :p="p" class="scale--lg" />
  </section>

  <PaperDetailActions :c="c" />
  <p class="note">
    <AppIcon name="info" />
    <span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span>
  </p>
</template>
