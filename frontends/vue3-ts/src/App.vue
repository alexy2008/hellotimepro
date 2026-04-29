<script setup lang="ts">
import { onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";

const auth = useAuthStore();
const theme = useThemeStore();
const { hydrated, refreshToken } = storeToRefs(auth);

onMounted(() => {
  theme.hydrate();
  auth.hydrate();
});

// 一旦完成 hydrate，且本地有 refresh token 但还没拿到完整 user 信息，
// 主动拉一次 /me 验证登录态
watch(
  [hydrated, refreshToken],
  ([h, rt]) => {
    if (h && rt) void auth.refreshMe();
  },
  { immediate: true },
);
</script>

<template>
  <RouterView />
</template>
