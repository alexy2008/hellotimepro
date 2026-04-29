<script setup lang="ts">
import AppHeader from "./AppHeader.vue";
import AppFooter from "./AppFooter.vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

async function handleLogout(e: MouseEvent) {
  e.preventDefault();
  await auth.logout();
  window.location.assign("/");
}
</script>

<template>
  <AppHeader />
  <main class="cy-container">
    <div class="cy-me">
      <aside class="cy-me__nav">
        <RouterLink to="/me/created" active-class="is-active">📝 我创建的</RouterLink>
        <RouterLink to="/me/favorites" active-class="is-active">♥ 我收藏的</RouterLink>
        <RouterLink to="/me/profile" active-class="is-active">⚙ 账号设置</RouterLink>
        <span style="border-top:1px solid var(--color-border-subtle);margin:var(--space-3) 0" />
        <a
          href="/login"
          style="color: var(--color-danger-fg)"
          @click="handleLogout"
        >登出</a>
      </aside>
      <section class="cy-me__content">
        <RouterView />
      </section>
    </div>
  </main>
  <AppFooter />
</template>
