<!-- ============================================================
     指向 /create 的链接：已登录直接去（交给全局的 links 拦截）；
     匿名时先拦下，确认后再去 /login?redirect=%2Fcreate。
     其余属性（class、data-testid…）原样落到 <a> 上。
     ============================================================ -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { navigate } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { askLogin } from "@/state/login-prompt";
  import { loginPath } from "@/lib/redirect";

  let { children, ...rest }: HTMLAnchorAttributes & { children: Snippet } = $props();

  async function onclick(e: MouseEvent) {
    if (authStore.user) return;
    e.preventDefault();
    if (await askLogin("create")) navigate(loginPath("/create"));
  }
</script>

<a {...rest} href="/create" {onclick}>{@render children()}</a>
