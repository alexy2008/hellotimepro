<script lang="ts">
  import type { Snippet } from "svelte";
  import { link, useLocation } from "svelte-routing";
  import AppHeader from "./AppHeader.svelte";
  import AppFooter from "./AppFooter.svelte";
  import { authStore } from "@/stores/auth.svelte.ts";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const location = useLocation();
  const path = $derived($location.pathname);

  async function handleLogout(e: MouseEvent) {
    e.preventDefault();
    await authStore.logout();
    window.location.assign("/");
  }
</script>

<AppHeader />
<main class="cy-container">
  <div class="cy-me">
    <aside class="cy-me__nav">
      <a
        href="/me/created"
        use:link
        class={path.startsWith("/me/created") ? "is-active" : ""}
      >📝 我创建的</a>
      <a
        href="/me/favorites"
        use:link
        class={path.startsWith("/me/favorites") ? "is-active" : ""}
      >♥ 我收藏的</a>
      <a
        href="/me/profile"
        use:link
        class={path.startsWith("/me/profile") ? "is-active" : ""}
      >⚙ 账号设置</a>
      <span style:border-top="1px solid var(--color-border-subtle)" style:margin="var(--space-3) 0"></span>
      <a
        href="/login"
        style:color="var(--color-danger-fg)"
        onclick={handleLogout}
      >登出</a>
    </aside>
    <section class="cy-me__content">
      {@render children()}
    </section>
  </div>
</main>
<AppFooter />
