<!-- 登录 / 注册只给访客：进来时已经登录，就直接去 ?redirect=（或首页），不破坏当前会话。
     只在进入时判断一次——在本页登录成功后由表单自己跳转 -->
<script lang="ts">
  import { onMount, untrack, type Snippet } from "svelte";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { redirect } from "@/lib/nav";
  import { safeRedirect } from "@/lib/redirect";
  import { redirectParam } from "@/state/account.svelte.ts";

  let { children }: { children: Snippet } = $props();
  const signedIn = untrack(() => !!authStore.user);

  onMount(() => {
    if (signedIn) redirect(safeRedirect(redirectParam(), "/"));
  });
</script>

{#if !signedIn}{@render children()}{/if}
