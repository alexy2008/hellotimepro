<!-- ============================================================
     需要登录的路由（创建、我的）：
     - 本地只剩 refresh token（user 还没拿到）：接口会自动续期，先把 user 取回来再判断
     - 没登录（或登录态中途丢了）：换成 /login?redirect=<当前路径>
     - 子内容按 user.id 加 {#key}：换账号就重建页面状态（草稿表单、资料表单…）
     ============================================================ -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { loginPath } from "@/lib/redirect";
  import { redirect } from "@/lib/nav";

  let { children }: { children: Snippet } = $props();

  const needCheck = !authStore.user && !!authStore.refreshToken;
  let checking = $state(needCheck);
  if (needCheck) void authStore.refreshMe().finally(() => (checking = false));

  $effect(() => {
    if (!checking && !authStore.user) redirect(loginPath(location.pathname + location.search));
  });
</script>

{#if authStore.user}
  {#key authStore.user.id}{@render children()}{/key}
{/if}
