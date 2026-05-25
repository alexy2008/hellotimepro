<script lang="ts">
  // 路由守卫：未登录用户访问受保护页面时跳 /login?from=<currentPath>。
  // 已登录或拥有 refresh token 的状态都放行（refresh token 路径会自动 refresh）。

  import type { Snippet } from "svelte";
  import { navigate, useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const location = useLocation();

  $effect(() => {
    if (!authStore.hydrated) return;
    if (authStore.user || authStore.refreshToken) return;
    const from = $location.pathname + $location.search;
    navigate(`/login?from=${encodeURIComponent(from)}`, { replace: true });
  });
</script>

{#if authStore.hydrated && (authStore.user || authStore.refreshToken)}
  {@render children()}
{/if}
