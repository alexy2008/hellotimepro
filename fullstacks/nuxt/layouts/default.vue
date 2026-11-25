<!-- ============================================================
     总布局：按当前皮肤挑外壳，中间是路由页面。
     外壳的 DOM 约定照 2.0 原型：header.hdr / main#view / footer.ftr / nav.tabbar，
     皮肤样式里有 #view、body[data-route] 等选择器依赖这些约定。
     「时笺」的 SVG 滤镜与「琥珀」的星空背景在这里各挂一次。
     ============================================================ -->
<script setup lang="ts">
import { computed, watch } from "vue";
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
provideHealth();
const shell = computed(() => SHELL[ui.skin]);

// 启动时不主动 refreshMe：登录态由持久化的 user 渲染，access token 留给真正带鉴权的请求惰性刷新。
// 否则每次整页加载都会轮换 refresh token；响应没来得及保存就被下一次整页导航打断时，
// 下一页拿旧令牌再刷新会被当作重放，整族吊销后误登出（docs/03-roadmap.md「整页 reload 误登出」）。
// 令牌失效由第一次带鉴权的请求发现，onAuthLost 清空登录态，下面的监听再把受保护页面送去登录。

// 登录态在受保护页面上丢了（refresh 失败等）：守卫不会再跑一遍，这里补一次跳转
watch(
  () => !auth.user && !auth.refreshToken,
  (lost) => {
    if (lost && route.meta.requiresAuth) void router.replace(loginPath(route.fullPath));
  },
);
</script>

<template>
  <div class="app-shell">
    <PaperFilters />
    <AmberBackdrop />
    <a class="skip" href="#view">跳到正文</a>
    <component :is="shell.Header" />
    <main id="view" tabindex="-1" data-allow-mismatch="text">
      <slot />
    </main>
    <component :is="shell.Footer" />
    <component :is="shell.TabBar" />
    <ToastHost />
    <DialogHost />
  </div>
</template>

<style>
/* Nuxt 挂载点不参与布局：皮肤样式里 body 是纵向 flex，页头 / #view / 页脚是它的直接子项 */
#__nuxt, .app-shell {
  display: contents;
}
:root[data-skin-pending] #__nuxt {
  visibility: hidden;
}
</style>
