<script lang="ts">
  import { link, navigate, useLocation } from "svelte-routing";
  import { api } from "@/api/client";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { ApiError } from "@/types";
  import Alert from "@/components/Alert.svelte";

  const location = useLocation();

  // 已登录用户访问登录页 → 直接跳首页
  $effect(() => {
    if (authStore.hydrated && authStore.user) {
      navigate("/", { replace: true });
    }
  });

  let email = $state("");
  let password = $state("");
  let busy = $state(false);
  let err = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    err = null;
    busy = true;
    try {
      const tokens = await api.login({ email: email.trim(), password });
      authStore.setTokens(tokens);
      const params = new URLSearchParams($location.search);
      const from = params.get("from") ?? "/me/created";
      navigate(from, { replace: true });
    } catch (e2) {
      err = e2 instanceof ApiError ? e2.message : "登录失败";
    } finally {
      busy = false;
    }
  }
</script>

<main
  class="cy-container cy-container--narrow"
  style:margin-top="var(--space-12)"
  style:margin-bottom="var(--space-16)"
>
  <div class="cy-card" style:max-width="440px" style:margin="0 auto">
    <h1 style:font-family="var(--font-display)" style:font-size="var(--font-size-3xl)" style:margin="0 0 var(--space-2)">
      欢迎回来
    </h1>
    <p style:color="var(--color-text-secondary)" style:margin="0 0 var(--space-8)">
      你留给未来的信，还在等你开启。
    </p>

    <form class="cy-form" onsubmit={submit}>
      <div class="cy-field">
        <label for="email">邮箱</label>
        <input
          id="email"
          class="cy-input"
          type="email"
          autocomplete="email"
          required
          bind:value={email}
        />
      </div>
      <div class="cy-field">
        <label for="pwd">密码</label>
        <input
          id="pwd"
          class="cy-input"
          type="password"
          autocomplete="current-password"
          required
          bind:value={password}
        />
        <span class="cy-field__hint">忘记密码？M1 暂不支持找回，请联系管理员重置。</span>
      </div>

      <button
        class="cy-btn cy-btn--primary cy-btn--lg"
        type="submit"
        style:width="100%"
        disabled={busy}
      >
        {busy ? "登录中…" : "登录"}
      </button>

      <div
        style:text-align="center"
        style:color="var(--color-text-muted)"
        style:font-size="var(--font-size-sm)"
      >
        还没有账号？
        <a href="/register" use:link style:color="var(--color-brand-primary)">立即注册</a>
      </div>
    </form>
  </div>

  {#if err}
    <div style:max-width="440px" style:margin="var(--space-6) auto 0">
      <Alert variant="danger">{err}</Alert>
    </div>
  {/if}
</main>
