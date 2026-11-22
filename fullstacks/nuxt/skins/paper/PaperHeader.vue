<!-- ============================================================
     「时笺」页头：品牌 · 主导航 · 写一枚 · 皮肤开关 · 明暗 · 账号
     结构与类名照 2.0 原型 paper/shell.js；样式在 spec/styles/paper/components.css
     ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { navAttrs, useNavKey, useScrolled, useThemeToggle } from "@/composables/useShell";
import AppIcon from "@/components/AppIcon.vue";
import CreateLink from "@/components/CreateLink.vue";
import SkinSwitch from "@/components/SkinSwitch.vue";
import UserMenu from "@/components/UserMenu.vue";
import PaperBrand from "./PaperBrand.vue";

const auth = useAuthStore();
const cur = useNavKey();
const scrolled = useScrolled();
const { theme, toggle } = useThemeToggle();
</script>

<template>
  <header :class="['hdr', { 'is-scrolled': scrolled }]">
    <div class="wrap hdr__in">
      <PaperBrand label="HelloTime Pro 首页" />
      <nav class="nav" aria-label="主导航">
        <NuxtLink to="/" data-testid="nav-plaza" v-bind="navAttrs('plaza', cur)">广场</NuxtLink>
        <NuxtLink to="/open" data-testid="nav-open" v-bind="navAttrs('open', cur)">开启</NuxtLink>
        <NuxtLink to="/about" data-testid="nav-about" v-bind="navAttrs('about', cur)">关于</NuxtLink>
      </nav>
      <div class="hdr__act">
        <CreateLink data-testid="nav-create" v-bind="navAttrs('create', cur, 'btn btn--ghost btn--sm hdr__write')">
          <AppIcon name="pen" />
          写一枚
        </CreateLink>
        <SkinSwitch />
        <button
          class="iconbtn theme"
          type="button"
          data-testid="theme-toggle"
          :aria-label="theme === 'dark' ? '切换到日间主题' : '切换到夜间主题'"
          @click="toggle"
        >
          <AppIcon name="sun" class="theme__sun" />
          <AppIcon name="moon" class="theme__moon" />
        </button>
        <UserMenu v-if="auth.user" created-icon="mail" />
        <template v-else>
          <NuxtLink class="btn btn--text hdr__login" to="/login" data-testid="nav-login">登录</NuxtLink>
          <NuxtLink class="btn btn--primary btn--sm" to="/register" data-testid="nav-register">注册</NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
