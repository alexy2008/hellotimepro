<!-- 「琥珀」登录（/login）：结构与类名照 2.0 原型 amber/view-account.js -->
<script lang="ts">
  import { useLogin, withRedirect } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import FormField from "@/components/FormField.svelte";
  import PasswordField from "@/components/PasswordField.svelte";
  import AmberAuthArt from "./AmberAuthArt.svelte";

  const f = useLogin();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void f.submit();
  }
</script>

<div class="page page--auth">
  <div class="container auth">
    <div class="auth__card card">
      <AmberAuthArt state="locked" />
      <div class="eyebrow eyebrow--center">Welcome back</div>
      <h1 class="page-title">欢迎回来</h1>
      <p class="page-lead">你封存的胶囊，还在等你回来开启。</p>
      {#if f.redirect}
        <p class="tip">
          <AppIcon name="info" />
          <span>登录后会带你回到刚才的页面。</span>
        </p>
      {/if}
      <form novalidate {onsubmit} oninput={f.onInput}>
        <FormField
          id="email"
          bind:value={f.email}
          label="邮箱"
          type="email"
          lead="mail"
          autocomplete="email"
          placeholder="you@example.com"
          error={f.errors.email}
          testId="login-email"
          autofocus
        />
        <PasswordField
          id="password"
          bind:value={f.password}
          label="密码"
          lead="lock"
          autocomplete="current-password"
          placeholder="输入密码"
          hint="忘记密码？当前版本暂不支持找回。"
          error={f.errors.password}
          testId="login-password"
        />
        <div class="form__err" role="alert" data-testid={f.errors.form ? "login-error" : undefined}>{f.errors.form}</div>
        <button class={["btn", "btn--primary", "btn--lg", "btn--block", f.busy && "is-busy"]} type="submit" disabled={f.busy} data-testid="login-submit">
          <span>{f.busy ? "登录中…" : "登录"}</span>
          <AppIcon name="arrow" />
        </button>
      </form>
      <p class="auth__alt">
        还没有账号？
        <a href={withRedirect("/register", f.redirect)} data-testid="to-register">注册一个</a>
      </p>
    </div>
  </div>
</div>
