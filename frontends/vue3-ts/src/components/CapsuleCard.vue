<script setup lang="ts">
import { computed } from "vue";
import type { CapsuleListItem } from "@/types";
import { avatarUrl } from "@/utils/avatar";
import { countdownTo, fmtNumber } from "@/utils/format";
import { useCountdown } from "@/composables/useCountdown";
import FavoriteButton from "./FavoriteButton.vue";

interface Props {
  capsule: CapsuleListItem;
  showCreator?: boolean;
  hideFavorite?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showCreator: true,
  hideFavorite: false,
});

const opened = computed(() => props.capsule.isOpened);

// 倒计时（仅未开启卡片需要每秒刷新）
const { now } = useCountdown(() => !opened.value);
const cd = computed(() => countdownTo(props.capsule.openAt, now.value));

const createdAtDate = computed(() =>
  new Date(props.capsule.createdAt).toLocaleDateString("zh-CN"),
);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
</script>

<template>
  <article :class="['cy-capsule', opened ? 'cy-capsule--opened' : 'cy-capsule--sealed']">
    <div class="cy-capsule__head">
      <span :class="['cy-badge', opened ? 'cy-badge--opened' : 'cy-badge--sealed']">
        {{ opened ? "已开启" : "未开启" }}
      </span>
      <RouterLink
        :to="`/c/${capsule.code}`"
        class="cy-capsule__code"
        style="text-decoration: none"
      >
        {{ capsule.code }}
      </RouterLink>
    </div>

    <RouterLink
      :to="`/c/${capsule.code}`"
      style="text-decoration: none; color: inherit"
    >
      <h3 class="cy-capsule__title">{{ capsule.title }}</h3>
    </RouterLink>

    <p v-if="!opened" class="cy-capsule__countdown">
      ⏳ 还剩 {{ fmtNumber(cd.days) }} 天 · {{ pad2(cd.hours) }}:{{ pad2(cd.minutes) }}:{{ pad2(cd.seconds) }}
    </p>
    <p v-if="opened && capsule.contentPreview" class="cy-capsule__preview">
      {{ capsule.contentPreview }}
    </p>

    <div class="cy-capsule__meta">
      <span v-if="showCreator" class="cy-capsule__creator">
        <img :src="avatarUrl(capsule.creator.avatarId)" alt="" />
        {{ capsule.creator.nickname }}
      </span>
      <span v-else style="color: var(--color-text-muted)">
        创建于 {{ createdAtDate }}
      </span>
      <slot name="right">
        <FavoriteButton v-if="!hideFavorite" :capsule="capsule" />
      </slot>
    </div>
  </article>
</template>
