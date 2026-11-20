<!-- ============================================================
     总布局：按当前皮肤挑外壳，中间是路由页面。
     外壳的 DOM 约定照 2.0 原型：header.hdr / main#view / footer.ftr / nav.tabbar，
     皮肤样式里有 #view、body[data-route] 等选择器依赖这些约定。
     「时笺」的 SVG 滤镜与「琥珀」的星空背景在这里各挂一次。
     ============================================================ -->
<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { loginPath } from "@/lib/redirect";
import ToastHost from "@/components/ToastHost.vue";
import DialogHost from "@/components/DialogHost.vue";
import PaperFilters from "@/skins/paper/PaperFilters.vue";
import PaperHeader from "@/skins/paper/PaperHeader.vue";
import PaperFooter from "@/skins/paper/PaperFooter.vue";
import PaperTabBar from "@/skins/paper/PaperTabBar.vue";
import AmberBackdrop from "@/skins/amber/AmberBackdrop.vue";
import AmberHeader from "@/skins/amber/AmberHeader.vue";
import AmberFooter from "@/skins/amber/AmberFooter.vue";
import AmberTabBar from "@/skins/amber/AmberTabBar.vue";

const SHELL = {
  paper: { Header: PaperHeader, Footer: PaperFooter, TabBar: PaperTabBar },
  amber: { Header: AmberHeader, Footer: AmberFooter, TabBar: AmberTabBar },
};

const ui = useUiStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const shell = computed(() => SHELL[ui.skin]);

// 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
watch(
  [() => auth.hydrated, () => auth.refreshToken],
  ([hydrated, rt]) => {
    if (hydrated && rt) void auth.refreshMe();
  },
  { immediate: true },
);

// 登录态在受保护页面上丢了（refresh 失败等）：守卫不会再跑一遍，这里补一次跳转
watch(
  () => !auth.user && !auth.refreshToken,
  (lost) => {
    if (lost && route.meta.requiresAuth) void router.replace(loginPath(route.fullPath));
  },
);
</script>

<template>
  <PaperFilters />
  <AmberBackdrop />
  <a class="skip" href="#view">跳到正文</a>
  <component :is="shell.Header" />
  <main id="view" tabindex="-1">
    <RouterView />
  </main>
  <component :is="shell.Footer" />
  <component :is="shell.TabBar" />
  <ToastHost />
  <DialogHost />
</template>

<style>
/* Vue 挂载点不参与布局：皮肤样式里 body 是纵向 flex，页头 / #view / 页脚是它的直接子项 */
#app {
  display: contents;
}
</style>
