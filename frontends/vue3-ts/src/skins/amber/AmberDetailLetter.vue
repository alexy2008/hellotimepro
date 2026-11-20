<!-- 详情 · 已开启：信纸自上而下展开，邮戳「啪」地盖上（reveal 时） -->
<script setup lang="ts">
import { computed } from "vue";
import type { CapsuleDetail } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { paragraphs } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import AmberBack from "./AmberBack.vue";
import AmberDetailActions from "./AmberDetailActions.vue";
import AmberStamp from "./AmberStamp.vue";
import AmberVisBadge from "./AmberVisBadge.vue";
import { dash } from "./art";

const props = defineProps<{ c: CapsuleDetail; reveal: boolean }>();
const openAt = computed(() => ms(props.c.openAt));
const createdAt = computed(() => ms(props.c.createdAt));
</script>

<template>
  <AmberBack />
  <div :class="['letter-page', { 'is-reveal': reveal }]">
    <article class="letter">
      <div class="letter__meta">
        <span class="mono">{{ c.code }}</span>
        <i />
        <AmberVisBadge :in-plaza="c.inPlaza" />
      </div>
      <h1 class="letter__title" data-testid="detail-title">{{ c.title }}</h1>
      <div class="letter__from">
        <AppAvatar :id="c.creator.avatarId" />
        {{ c.creator.nickname }} 写于 {{ fmt.cn(createdAt) }}
      </div>
      <div class="letter__body" data-testid="detail-content">
        <p v-for="(lines, i) in paragraphs(c.content)" :key="i" :style="{ '--i': i }">
          <template v-for="(line, k) in lines" :key="k"><br v-if="k" />{{ line }}</template>
        </p>
      </div>
      <footer class="letter__foot">
        <div class="letter__span">
          <div>
            <AppIcon name="hourglass" />
            这封信在时间里沉睡了 <b>{{ fmt.span(openAt - createdAt) }}</b>
          </div>
          <span class="mono">{{ dash(createdAt) }} 封存 → {{ dash(openAt) }} 开启</span>
        </div>
        <div class="letter__sign">
          <AmberStamp :date="openAt" />
          <span>—— {{ c.creator.nickname }}</span>
        </div>
      </footer>
    </article>
    <AmberDetailActions :c="c" letter />
    <p v-if="!c.inPlaza" class="tip tip--quiet">
      <AppIcon name="lock" />
      <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
    </p>
  </div>
</template>
