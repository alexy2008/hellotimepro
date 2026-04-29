<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { usePlazaStore } from "@/stores/plaza";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import type { CapsuleListItem, CapsuleDetail } from "@/types";

interface Props {
  capsule: Pick<
    CapsuleListItem | CapsuleDetail,
    "id" | "favoritedByMe" | "favoriteCount"
  >;
  size?: "sm" | "md";
}

const props = withDefaults(defineProps<Props>(), { size: "sm" });
const emit = defineEmits<{
  (e: "change", favorited: boolean, count: number): void;
}>();

const auth = useAuthStore();
const plaza = usePlazaStore();
const router = useRouter();
const { user } = storeToRefs(auth);

const active = ref(props.capsule.favoritedByMe);
const count = ref(props.capsule.favoriteCount);
const busy = ref(false);
const err = ref<string | null>(null);

// props 变化时同步本地 ref——避免 vue-router 复用同路由不同 params 的组件实例
// 时（如同一详情页切换胶囊），或父组件外部更新后，本组件仍显示旧值。
watch(
  () => [
    props.capsule.id,
    props.capsule.favoritedByMe,
    props.capsule.favoriteCount,
  ] as const,
  ([, fav, c]) => {
    active.value = fav;
    count.value = c;
  },
);

const favoriteColor = computed(() =>
  active.value
    ? "var(--color-favorite-active)"
    : "var(--color-favorite-inactive)",
);

async function toggle() {
  err.value = null;

  if (!user.value) {
    // 匿名用户：跳登录提示，而不是静默失败
    const yes = window.confirm("登录后才能收藏，前往登录？");
    if (yes) router.push("/login");
    return;
  }

  busy.value = true;
  try {
    if (active.value) {
      await api.unfavorite(props.capsule.id);
      const next = Math.max(0, count.value - 1);
      active.value = false;
      count.value = next;
      plaza.patchFavorited(props.capsule.id, false, next);
      emit("change", false, next);
    } else {
      const r = await api.favorite(props.capsule.id);
      active.value = true;
      count.value = r.favoriteCount;
      plaza.patchFavorited(props.capsule.id, true, r.favoriteCount);
      emit("change", true, r.favoriteCount);
    }
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "操作失败";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button
    v-if="size === 'md'"
    type="button"
    :class="['cy-btn', 'cy-btn--accent', active ? 'is-active' : '']"
    :disabled="busy"
    :title="err ?? undefined"
    @click="toggle"
  >
    <span :style="{ color: favoriteColor }">{{ active ? "♥" : "♡" }}</span>
    收藏 · {{ count }}
  </button>
  <button
    v-else
    type="button"
    :class="['cy-capsule__fav', active ? 'is-active' : '']"
    :disabled="busy"
    :title="err ?? undefined"
    @click="toggle"
  >
    {{ active ? "♥" : "♡" }} {{ count }}
  </button>
</template>
