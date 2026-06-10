<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import ThemeToggle from "./ThemeToggle.vue";
import { avatarUrl } from "@/utils/avatar";
import { useClickOutside } from "@/composables/useClickOutside";

const auth = useAuthStore();
const { user } = storeToRefs(auth);

const menuOpen = ref(false);
const menuRef = ref<HTMLDivElement | null>(null);

useClickOutside(menuRef, menuOpen, () => {
  menuOpen.value = false;
});

function shortName(name: string): string {
  return Array.from(name).slice(0, 4).join("");
}

function closeMenu() {
  menuOpen.value = false;
}

async function handleLogout() {
  closeMenu();
  await auth.logout();
  // 与 React 版一致：登出后直接整页跳首页，确保所有 store / 内存缓存清干净。
  // 这里不再叠加 router.push（assign 会立即触发整页跳转，router.push 无意义）。
  window.location.assign("/");
}
</script>

<template>
  <header class="cy-header">
    <div class="cy-container cy-header__inner">
      <RouterLink to="/" class="cy-brand">
        <img class="cy-brand__mark" src="/logo.svg" width="38" height="38" alt="" />
        HelloTime<span class="cy-brand__pro">PRO</span>
      </RouterLink>
      <nav class="cy-nav">
        <!--
          广场用 exact-active-class（仅 path === '/' 时激活），
          其他用 active-class（前缀匹配，对应嵌套子路由）。
        -->
        <RouterLink to="/" exact-active-class="cy-nav__active">
          广场
        </RouterLink>
        <RouterLink to="/open" active-class="cy-nav__active">
          开启
        </RouterLink>
        <RouterLink to="/about" active-class="cy-nav__active">
          关于
        </RouterLink>
      </nav>
      <div class="cy-header__actions">
        <!--
          ThemeToggle 与鉴权态都来自 localStorage，服务端渲染时取不到（主题按默认、
          一律未登录），与客户端 hydrate 后的真实状态不一致会触发 hydration mismatch。
          用 <ClientOnly> 让这两块只在客户端渲染。
        -->
        <ClientOnly>
        <ThemeToggle />
        <template v-if="user">
          <div ref="menuRef" class="cy-user-menu">
            <button
              type="button"
              class="cy-user-chip cy-user-chip--button"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              :aria-label="`${user.nickname} 的菜单`"
              :title="user.nickname"
              @click="menuOpen = !menuOpen"
            >
              <span :title="user.nickname">{{ shortName(user.nickname) }}</span>
              <img :src="avatarUrl(user.avatarId)" alt="" />
              <span class="cy-user-chip__chevron" aria-hidden="true">⌄</span>
            </button>
            <Transition name="cy-fade">
              <div v-if="menuOpen" class="cy-user-dropdown" role="menu">
                <RouterLink
                  to="/me/created"
                  role="menuitem"
                  class="cy-user-dropdown__item"
                  active-class="is-active"
                  @click="closeMenu"
                >
                  <span aria-hidden="true">📝</span>
                  <span>我创建的</span>
                </RouterLink>
                <RouterLink
                  to="/me/favorites"
                  role="menuitem"
                  class="cy-user-dropdown__item"
                  active-class="is-active"
                  @click="closeMenu"
                >
                  <span aria-hidden="true">♥</span>
                  <span>我收藏的</span>
                </RouterLink>
                <RouterLink
                  to="/me/profile"
                  role="menuitem"
                  class="cy-user-dropdown__item"
                  active-class="is-active"
                  @click="closeMenu"
                >
                  <span aria-hidden="true">⚙</span>
                  <span>账号设置</span>
                </RouterLink>
                <span class="cy-user-dropdown__divider" />
                <button
                  type="button"
                  class="cy-user-dropdown__item cy-user-dropdown__item--danger"
                  role="menuitem"
                  @click="handleLogout"
                >
                  <span aria-hidden="true">↩</span>
                  <span>登出</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>
        <template v-else>
          <RouterLink to="/login" class="cy-btn cy-btn--ghost cy-btn--sm">
            登录
          </RouterLink>
          <RouterLink to="/register" class="cy-btn cy-btn--primary cy-btn--sm">
            注册
          </RouterLink>
        </template>
        </ClientOnly>
      </div>
    </div>
  </header>
</template>

<style scoped>
.cy-fade-enter-active,
.cy-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.cy-fade-enter-from,
.cy-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
