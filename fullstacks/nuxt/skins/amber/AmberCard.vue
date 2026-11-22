<!-- ============================================================
     「琥珀」广场卡片：一枚专属配色的胶囊。
     状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒当场翻面。
     ============================================================ -->
<script setup lang="ts">
import { computed } from "vue";
import type { CapsuleListItem } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { paletteOf } from "@/lib/palette";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import FavButton from "@/components/FavButton.vue";
import AmberBadge from "./AmberBadge.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
import { cdShort, preview } from "./art";

const props = withDefaults(
  defineProps<{
    c: CapsuleListItem;
    now: number;
    i?: number;
    rank?: number;
    mine?: boolean;
    /** 「我收藏的」里用 fav-item / row-open（spec/ui/testids.md §3.7） */
    testId?: string;
    openTestId?: string;
  }>(),
  { i: 0, rank: 0, mine: false, testId: "capsule-card", openTestId: "card-open" },
);
defineEmits<{ favChange: [favorited: boolean, count: number] }>();

const openAt = computed(() => ms(props.c.openAt));
const createdAt = computed(() => ms(props.c.createdAt));
const opened = computed(() => props.c.isOpened || openAt.value <= props.now);
/** 刚到点，等列表刷新回来之前先翻面 */
const flipping = computed(() => !props.c.isOpened && openAt.value <= props.now);
</script>

<template>
  <article
    :class="['pc', opened ? 'is-opened' : 'is-locked', { 'is-flipping': flipping }]"
    :style="{ '--glow': paletteOf(c.code).glow, '--i': i }"
    :data-testid="testId"
    :data-code="c.code"
    :data-state="opened ? 'opened' : 'sealed'"
    :data-in-plaza="c.inPlaza"
  >
    <NuxtLink
      class="pc__link"
      :to="`/capsules/${c.code}`"
      :aria-label="`${c.title}，${opened ? '已开启' : '封存中'}`"
      :data-testid="openTestId"
    />
    <div class="pc__top">
      <div class="pc__art"><AmberCapsuleArt :code="c.code" :state="opened ? 'opened' : 'locked'" :width="150" /></div>
      <div class="pc__badges">
        <AmberBadge v-if="opened" kind="opened" icon="mail">已开启</AmberBadge>
        <AmberBadge v-else kind="locked" icon="lock">封存中</AmberBadge>
        <AmberBadge v-if="rank" kind="hot" icon="fire">热度 No.{{ rank }}</AmberBadge>
        <AmberBadge v-if="!c.inPlaza" kind="private" icon="lock">未公开</AmberBadge>
      </div>
    </div>
    <h3 class="pc__title" data-testid="card-title">{{ c.title }}</h3>
    <div class="pc__by">
      <AppAvatar :id="c.creator.avatarId" />
      <span class="pc__name">{{ c.creator.nickname }}</span>
      <em v-if="mine" class="me-tag">我</em>
      <i />
      <span>封存于 {{ fmt.date(createdAt) }}</span>
    </div>
    <div class="pc__body">
      <p v-if="opened" class="pc__excerpt">{{ preview(c.contentPreview) }}</p>
      <template v-else>
        <div class="pc__cd">
          <AppIcon name="hourglass" />
          <span class="pc__time mono">{{ cdShort(openAt, now) }}</span>后开启
        </div>
        <div class="pc__progress" title="从封存到开启，时间已经走过的比例">
          <span :style="{ width: `${Math.max(2, fmt.progress(createdAt, openAt, now))}%` }" />
        </div>
      </template>
    </div>
    <div class="pc__foot">
      <span class="pc__when">
        <AppIcon name="calendar" />
        <span>{{ fmt.dateTime(openAt) }} {{ opened ? "已开启" : "开启" }}</span>
      </span>
      <FavButton :capsule="c" @change="(f, n) => $emit('favChange', f, n)" />
    </div>
  </article>
</template>
