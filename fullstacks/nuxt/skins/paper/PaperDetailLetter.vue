<!-- 详情 · 已启封：一页信笺，字迹逐段显影（reveal 时） -->
<script setup lang="ts">
import { computed } from "vue";
import type { CapsuleDetail } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { paragraphs } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import PaperBack from "./PaperBack.vue";
import PaperDetailActions from "./PaperDetailActions.vue";
import PaperPostmark from "./PaperPostmark.vue";
import PaperSeal from "./PaperSeal.vue";
import PaperVisTag from "./PaperVisTag.vue";

const props = defineProps<{ c: CapsuleDetail; reveal: boolean }>();
const openAt = computed(() => ms(props.c.openAt));
const createdAt = computed(() => ms(props.c.createdAt));
</script>

<template>
  <PaperBack />
  <article :class="['letter', { 'letter--reveal': reveal }]">
    <div class="letter__pm">
      <PaperPostmark :line1="fmt.date(openAt)" line2="已 启 封" class="pm--letter" />
    </div>
    <div class="letter__meta">
      <span class="mono">NO. {{ c.code }}</span>
      <PaperVisTag :in-plaza="c.inPlaza" />
    </div>
    <h1 class="letter__title" data-testid="detail-title">{{ c.title }}</h1>
    <dl class="letter__facts">
      <div>
        <dt>封存</dt>
        <dd class="mono">{{ fmt.dateTime(createdAt) }}</dd>
      </div>
      <div>
        <dt>启封</dt>
        <dd class="mono">{{ fmt.dateTime(openAt) }}</dd>
      </div>
      <div>
        <dt>在途</dt>
        <dd>{{ fmt.span(openAt - createdAt) }}</dd>
      </div>
    </dl>
    <div class="letter__body" data-testid="detail-content">
      <p v-for="(lines, i) in paragraphs(c.content)" :key="i" :style="{ '--i': i }">
        <template v-for="(line, k) in lines" :key="k"><br v-if="k" />{{ line }}</template>
      </p>
    </div>
    <footer class="letter__sign">
      <div class="letter__from">
        <span>——</span>
        <AppAvatar :id="c.creator.avatarId" />
        <b>{{ c.creator.nickname }}</b>
      </div>
      <div class="letter__date">写于 {{ fmt.cn(createdAt) }}</div>
      <PaperSeal ch="启" variant="line" class="letter__seal" />
    </footer>
  </article>
  <PaperDetailActions :c="c" />
  <p v-if="c.inPlaza" class="note note--ok">
    <AppIcon name="check" />
    <span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span>
  </p>
  <p v-else class="note">
    <AppIcon name="lock" />
    <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
  </p>
</template>
