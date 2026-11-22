<!-- ============================================================
     「琥珀」悬浮胶囊顶栏：品牌 · 导航（高亮底跟着当前页滑动）· 皮肤开关 · 星夜 / 晨曦开关 · 账号
     结构与类名照 2.0 原型 amber/shell.js；样式在 spec/styles/amber/components.css
     ============================================================ -->
<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useAuthStore } from "@/stores/auth";
import { navAttrs, useNavKey, useScrolled, useThemeToggle, type NavKey } from "@/composables/useShell";
import { useSlider } from "@/composables/useMotion";
import CreateLink from "@/components/CreateLink.vue";
import SkinSwitch from "@/components/SkinSwitch.vue";
import UserMenu from "@/components/UserMenu.vue";
import AmberLogo from "./AmberLogo.vue";

const NAV: Array<[Exclude<NavKey, null | "me">, string, string]> = [
  ["plaza", "/", "胶囊广场"],
  ["create", "/create", "写一枚"],
  ["open", "/open", "开启胶囊"],
  ["about", "/about", "关于"],
];

const auth = useAuthStore();
const cur = useNavKey();
const scrolled = useScrolled();
const { theme, toggle } = useThemeToggle();
const nav = useTemplateRef<HTMLElement>("nav");
// 导航高亮底：跟着当前页滑过去（首次定位不带过渡；登录态变化会改变顶栏宽度）
const ink = useSlider(nav, ".nav__link.is-active", [cur, () => auth.user], true);
</script>

<template>
  <header :class="['hdr', { 'is-scrolled': scrolled }]">
    <div class="hdr__bar">
      <NuxtLink class="brand" to="/" aria-label="HelloTime Pro 首页">
        <AmberLogo :size="34" class="brand__logo" />
        <span class="brand__name">HelloTime<small>PRO</small></span>
      </NuxtLink>
      <nav ref="nav" class="nav" aria-label="主导航">
        <span class="nav__ink" aria-hidden="true" :style="ink" />
        <template v-for="[k, to, label] in NAV" :key="k">
          <CreateLink v-if="k === 'create'" data-testid="nav-create" v-bind="navAttrs(k, cur, 'nav__link')">{{ label }}</CreateLink>
          <NuxtLink v-else :to="to" :data-testid="`nav-${k}`" v-bind="navAttrs(k, cur, 'nav__link')">{{ label }}</NuxtLink>
        </template>
      </nav>
      <div class="hdr__tools">
        <SkinSwitch />
        <button
          class="theme-toggle"
          type="button"
          role="switch"
          data-testid="theme-toggle"
          :aria-checked="theme === 'light'"
          :aria-label="theme === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦'"
          @click="toggle"
        >
          <span class="theme-toggle__stars" />
          <span class="theme-toggle__cloud" />
          <span class="theme-toggle__knob" />
        </button>
        <UserMenu v-if="auth.user" created-icon="feather" />
        <template v-else>
          <NuxtLink class="btn btn--ghost btn--sm hdr__login" to="/login" data-testid="nav-login">登录</NuxtLink>
          <NuxtLink class="btn btn--primary btn--sm" to="/register" data-testid="nav-register">注册</NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
