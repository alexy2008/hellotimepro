<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { CapsuleDetail as CapsuleDetailT } from "@/types";
import { avatarUrl } from "@/utils/avatar";
import { countdownTo, fmtDateTime } from "@/utils/format";
import { useCountdown } from "@/composables/useCountdown";
import FavoriteButton from "./FavoriteButton.vue";
import CalendarUnit from "./CalendarUnit.vue";

interface Props {
  capsule: CapsuleDetailT;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "change", c: CapsuleDetailT): void;
  // expired 由父组件实现：接到事件后 reload，并 emit("change", 新对象)
  (e: "expired"): void;
}>();

const opened = computed(() => props.capsule.isOpened);

const { now } = useCountdown(() => !opened.value);
const cd = computed(() => countdownTo(props.capsule.openAt, now.value));

const autoOpening = ref(false);
let expiredTimer: number | undefined;

function clearExpiredTimer() {
  if (expiredTimer !== undefined) {
    window.clearTimeout(expiredTimer);
    expiredTimer = undefined;
  }
}

// 到点后自动通知父组件刷新；如果刷新后仍未开启就 1 秒后再试。
watch(
  () => [opened.value, props.capsule.openAt] as const,
  ([isOpened, openAtIso]) => {
    clearExpiredTimer();
    if (isOpened) return;

    const openAt = new Date(openAtIso).getTime();
    if (Number.isNaN(openAt)) return;

    function fire() {
      autoOpening.value = true;
      emit("expired");
      // 父组件收到 expired 后会重新设置 capsule prop；
      // 如果新 prop 仍未开启，watcher 会再排一次定时器。
      // 这里仅在「父组件没换 prop」时兜底重试。
      expiredTimer = window.setTimeout(() => {
        autoOpening.value = false;
        if (!props.capsule.isOpened) {
          fire();
        }
      }, 1000);
    }

    expiredTimer = window.setTimeout(
      fire,
      Math.max(0, openAt - Date.now() + 250),
    );
  },
  { immediate: true },
);

onUnmounted(clearExpiredTimer);

const codeCopied = ref(false);
const linkCopied = ref(false);

function copyCode() {
  void navigator.clipboard.writeText(props.capsule.code);
  codeCopied.value = true;
  setTimeout(() => { codeCopied.value = false; }, 2000);
}
function copyLink() {
  void navigator.clipboard.writeText(window.location.href);
  linkCopied.value = true;
  setTimeout(() => { linkCopied.value = false; }, 2000);
}

function onFavChange(fav: boolean, count: number) {
  emit("change", { ...props.capsule, favoritedByMe: fav, favoriteCount: count });
}
</script>

<template>
  <div class="cy-capsule-detail">
    <div class="cy-capsule-detail__head">
      <span :class="['cy-badge', opened ? 'cy-badge--opened' : 'cy-badge--sealed']">
        {{ opened ? "已开启" : "未开启" }}
      </span>
      <span v-if="capsule.inPlaza" class="cy-badge cy-badge--plaza">广场公开</span>
      <span class="cy-capsule__code">{{ capsule.code }}</span>
      <span style="color: var(--color-text-muted); font-size: var(--font-size-sm)">
        · 创建于 {{ fmtDateTime(capsule.createdAt) }}
      </span>
    </div>

    <h1 class="cy-capsule-detail__title">{{ capsule.title }}</h1>

    <template v-if="opened && capsule.content !== null">
      <div
        style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-4);font-size:var(--font-size-sm);color:var(--color-text-muted)"
      >
        <span>🔓</span>
        <span>
          开启于
          <strong style="color: var(--color-capsule-opened-accent)">
            {{ fmtDateTime(capsule.openAt) }}
          </strong>
        </span>
      </div>
      <div class="cy-capsule-detail__content">{{ capsule.content }}</div>
    </template>

    <div v-else class="cy-capsule-detail__sealed">
      <div style="font-size: var(--font-size-4xl); opacity: 0.7">🔒</div>
      <div
        style="color: var(--color-text-secondary); margin-top: var(--space-3); font-size: var(--font-size-sm); letter-spacing: 0.1em"
      >
        这封信还在上锁，将在以下时刻开启
      </div>
      <div class="cy-cal">
        <CalendarUnit :value="cd.days" label="天" />
        <span class="cy-cal-sep">:</span>
        <CalendarUnit :value="cd.hours" label="时" />
        <span class="cy-cal-sep">:</span>
        <CalendarUnit :value="cd.minutes" label="分" />
        <span class="cy-cal-sep">:</span>
        <CalendarUnit :value="cd.seconds" label="秒" />
      </div>
      <div style="color: var(--color-text-secondary)">
        <template v-if="cd.expired">
          <template v-if="autoOpening">正在开启…</template>
          <template v-else>正在同步开启状态…</template>
        </template>
        <template v-else>
          开启于
          <strong style="color: var(--color-text-primary)">
            {{ fmtDateTime(capsule.openAt) }}
          </strong>
        </template>
      </div>
    </div>

    <div
      style="margin-top:var(--space-6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)"
    >
      <div
        style="display:flex;align-items:center;gap:var(--space-2);color:var(--color-text-secondary);font-size:var(--font-size-sm)"
      >
        来自
        <img
          :src="avatarUrl(capsule.creator.avatarId)"
          alt=""
          style="width:32px;height:32px;border-radius:50%"
        />
        <strong style="color: var(--color-text-primary)">{{ capsule.creator.nickname }}</strong>
      </div>
      <div style="display:flex;gap:var(--space-3)">
        <button type="button" class="cy-btn cy-btn--ghost" @click="copyCode">
          {{ codeCopied ? "✓ 已复制!" : "📎 复制 8 位码" }}
        </button>
        <button type="button" class="cy-btn cy-btn--ghost" @click="copyLink">
          {{ linkCopied ? "✓ 已复制!" : "🔗 分享链接" }}
        </button>
        <FavoriteButton
          :capsule="capsule"
          size="md"
          @change="onFavChange"
        />
      </div>
    </div>

    <div
      v-if="!opened"
      class="cy-alert cy-alert--info"
      style="margin-top: var(--space-6)"
    >
      <span>ⓘ</span>
      <span>未开启的胶囊仅显示标题与倒计时，内容将在开启后公开到广场。</span>
    </div>
    <div
      v-if="opened && capsule.inPlaza"
      class="cy-alert cy-alert--success"
      style="margin-top: var(--space-6)"
    >
      <span>✓</span>
      <span>这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</span>
    </div>
  </div>
</template>
