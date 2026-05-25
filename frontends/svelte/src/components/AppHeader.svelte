<script lang="ts">
  import { link, useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import ThemeToggle from "./ThemeToggle.svelte";
  import { avatarUrl } from "@/utils/avatar";
  import { clickOutside } from "@/lib/clickOutside";

  const location = useLocation();

  let menuOpen = $state(false);

  // 当前路径，用于 nav 与下拉菜单 active 高亮
  const pathname = $derived($location.pathname);
  const isPlaza = $derived(pathname === "/");
  const isOpen = $derived(pathname.startsWith("/open"));
  const isAbout = $derived(pathname.startsWith("/about"));
  const isMeCreated = $derived(pathname.startsWith("/me/created"));
  const isMeFavorites = $derived(pathname.startsWith("/me/favorites"));
  const isMeProfile = $derived(pathname.startsWith("/me/profile"));

  function shortName(name: string): string {
    return Array.from(name).slice(0, 4).join("");
  }

  function closeMenu() {
    menuOpen = false;
  }

  async function handleLogout() {
    closeMenu();
    await authStore.logout();
    // 与 Vue / React 版一致：登出后直接整页跳首页，确保所有 store / 内存缓存清干净
    window.location.assign("/");
  }
</script>

<header class="cy-header">
  <div class="cy-container cy-header__inner">
    <a href="/" use:link class="cy-brand">
      <img class="cy-brand__mark" src="/logo.svg" width="38" height="38" alt="" />
      HelloTime<span class="cy-brand__pro">PRO</span>
    </a>
    <nav class="cy-nav">
      <a href="/" use:link class={isPlaza ? "cy-nav__active" : ""}>广场</a>
      <a href="/open" use:link class={isOpen ? "cy-nav__active" : ""}>开启</a>
      <a href="/about" use:link class={isAbout ? "cy-nav__active" : ""}>关于</a>
    </nav>
    <div class="cy-header__actions">
      <ThemeToggle />
      {#if authStore.user}
        <div
          class="cy-user-menu"
          use:clickOutside={{ handler: closeMenu, active: menuOpen }}
        >
          <button
            type="button"
            class="cy-user-chip cy-user-chip--button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${authStore.user.nickname} 的菜单`}
            title={authStore.user.nickname}
            onclick={() => (menuOpen = !menuOpen)}
          >
            <span title={authStore.user.nickname}>{shortName(authStore.user.nickname)}</span>
            <img src={avatarUrl(authStore.user.avatarId)} alt="" />
            <span class="cy-user-chip__chevron" aria-hidden="true">⌄</span>
          </button>
          {#if menuOpen}
            <div class="cy-user-dropdown" role="menu">
              <a
                href="/me/created"
                use:link
                role="menuitem"
                class={[
                  "cy-user-dropdown__item",
                  isMeCreated ? "is-active" : "",
                ].join(" ")}
                onclick={closeMenu}
              >
                <span aria-hidden="true">📝</span>
                <span>我创建的</span>
              </a>
              <a
                href="/me/favorites"
                use:link
                role="menuitem"
                class={[
                  "cy-user-dropdown__item",
                  isMeFavorites ? "is-active" : "",
                ].join(" ")}
                onclick={closeMenu}
              >
                <span aria-hidden="true">♥</span>
                <span>我收藏的</span>
              </a>
              <a
                href="/me/profile"
                use:link
                role="menuitem"
                class={[
                  "cy-user-dropdown__item",
                  isMeProfile ? "is-active" : "",
                ].join(" ")}
                onclick={closeMenu}
              >
                <span aria-hidden="true">⚙</span>
                <span>账号设置</span>
              </a>
              <span class="cy-user-dropdown__divider"></span>
              <button
                type="button"
                class="cy-user-dropdown__item cy-user-dropdown__item--danger"
                role="menuitem"
                onclick={handleLogout}
              >
                <span aria-hidden="true">↩</span>
                <span>登出</span>
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <a href="/login" use:link class="cy-btn cy-btn--ghost cy-btn--sm">登录</a>
        <a href="/register" use:link class="cy-btn cy-btn--primary cy-btn--sm">注册</a>
      {/if}
    </div>
  </div>
</header>
