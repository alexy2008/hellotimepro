<!-- ============================================================
     收藏按钮：两套皮肤同一份标记（.fav），卡片与详情页共用。
     - 2.0 起任何胶囊都能收藏（自己的、未公开的都可以）
     - 匿名用户先弹确认框提示登录，确认后带 ?redirect= 去登录
     - 乐观更新：点了立刻变，请求失败再滚回去并提示
     ============================================================ -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { usePlazaStore } from "@/stores/plaza";
import { toast } from "@/stores/feedback";
import { askLogin } from "@/composables/useLoginPrompt";
import { loginPath } from "@/lib/redirect";
import { fmt, reducedMotion } from "@/lib/fmt";
import AppIcon from "@/components/AppIcon.vue";

const props = withDefaults(
  defineProps<{
    capsule: { id: string; favoritedByMe: boolean; favoriteCount: number };
    size?: "sm" | "md";
  }>(),
  { size: "sm" },
);
const emit = defineEmits<{ change: [favorited: boolean, count: number] }>();

const auth = useAuthStore();
const plaza = usePlazaStore();
const route = useRoute();
const router = useRouter();

const on = ref(props.capsule.favoritedByMe);
const count = ref(props.capsule.favoriteCount);
/** 每次收藏加一：按钮以它为 key 重新挂载，is-pop 动画才会重播 */
const pop = ref(0);
const burst = ref(false);
let busy = false;

// 外部数据变了（列表刷新、另一处收藏）时跟上
watch(
  () => [props.capsule.id, props.capsule.favoritedByMe, props.capsule.favoriteCount] as const,
  ([, f, n]) => {
    on.value = f;
    count.value = n;
  },
);

/** 爆开的七粒小点 */
const dots = Array.from({ length: 7 }, (_, i) => ({ "--a": `${Math.round(i * 51.4 - 90)}deg`, "--d": `${15 + (i % 3) * 5}px` }));

async function toggle(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!auth.user) {
    if (await askLogin("favorite")) await router.push(loginPath(route.fullPath));
    return;
  }
  if (busy) return;
  busy = true;
  const next = !on.value;
  const prev = { on: on.value, count: count.value };
  const guess = Math.max(0, count.value + (next ? 1 : -1));
  on.value = next;
  count.value = guess;
  if (next) {
    pop.value++;
    burst.value = !reducedMotion();
    setTimeout(() => (burst.value = false), 720);
  }
  try {
    let final = guess;
    if (next) final = (await api.favorite(props.capsule.id)).favoriteCount;
    else {
      await api.unfavorite(props.capsule.id);
      toast("已取消收藏");
    }
    count.value = final;
    plaza.patchFavorited(props.capsule.id, next, final);
    emit("change", next, final);
  } catch {
    on.value = prev.on;
    count.value = prev.count;
    toast("收藏没有成功，请稍后再试", { tone: "error" });
  } finally {
    busy = false;
  }
}
</script>

<template>
  <button
    :key="pop"
    :class="['fav', `fav--${size}`, { 'is-on': on, 'is-pop': pop }]"
    type="button"
    :aria-pressed="on"
    :aria-label="`${on ? '取消收藏' : '收藏'}，已有 ${count} 人收藏`"
    data-testid="fav-button"
    :data-count="count"
    @click="toggle"
  >
    <span class="fav__ic">
      <AppIcon name="heart" />
      <span v-if="burst" class="burst"><i v-for="(d, i) in dots" :key="i" :style="d" /></span>
    </span>
    <span v-if="size === 'md'" class="fav__t">{{ on ? "已收藏" : "收藏" }}</span>
    <span class="fav__n">{{ fmt.num(count) }}</span>
  </button>
</template>
