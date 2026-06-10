<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import {
  type CapsuleDetail as CapsuleDetailT,
  type Envelope,
} from "@/types";
import CapsuleDetail from "@/components/CapsuleDetail.vue";
import Alert from "@/components/Alert.vue";

const route = useRoute();
const auth = useAuthStore();
const code = computed(() => String(route.params.code ?? "").toUpperCase());

// 通用取数：服务端渲染时直接在进程内命中 /api/v1 的 Nitro 处理器（无真实 HTTP 往返），
// 首屏即带胶囊内容，利于分享链接的 SEO 与首屏速度。胶囊凭码公开可读，故 SSR 匿名取数即可；
// favoritedByMe 这类鉴权投影由登录用户在客户端补取纠正（见 reloadAuthed）。
const { data: cap, error, refresh } = await useAsyncData(
  () => `capsule:${code.value}`,
  async () => {
    try {
      const env = await $fetch<Envelope<CapsuleDetailT>>(
        `/api/v1/capsules/${encodeURIComponent(code.value)}`,
      );
      if (!env.success || !env.data) {
        throw createError({
          statusCode: 404,
          message: env.message ?? "胶囊不存在",
          fatal: false,
        });
      }
      return env.data;
    } catch (e: unknown) {
      const err = e as {
        statusCode?: number;
        status?: number;
        message?: string;
        data?: { message?: string };
      };
      throw createError({
        statusCode: err.statusCode ?? err.status ?? 404,
        message: err.data?.message ?? err.message ?? "胶囊不存在",
        fatal: false,
      });
    }
  },
  { watch: [code] },
);

// 登录用户带 token 重新拉取，纠正 favoritedByMe；失败则沿用已有数据。
async function reloadAuthed() {
  try {
    cap.value = await api.capsuleByCode(code.value);
  } catch {
    /* 保留 SSR 数据 */
  }
}

onMounted(() => {
  if (auth.user) void reloadAuthed();
});

// 到点自动开启：登录用 authed 重取（保 favoritedByMe），否则用 useAsyncData refresh。
function onExpired() {
  if (auth.user) void reloadAuthed();
  else void refresh();
}

function onChange(c: CapsuleDetailT) {
  cap.value = c;
}
</script>

<template>
  <main class="cy-container">
    <CapsuleDetail
      v-if="cap"
      :capsule="cap"
      @change="onChange"
      @expired="onExpired"
    />
    <div v-else style="max-width: 560px; margin: var(--space-12) auto">
      <Alert variant="danger">{{ error?.message ?? "胶囊不存在" }}</Alert>
      <div style="margin-top: var(--space-4); text-align: center">
        <RouterLink class="cy-btn cy-btn--ghost" to="/open">返回输入码</RouterLink>
      </div>
    </div>
  </main>
</template>
