<!-- 「时笺」登录（/login）：结构与类名照 2.0 原型 paper/view-account.js -->
<script lang="ts">
  import { useLogin, withRedirect } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import FormField from "@/components/FormField.svelte";
  import PasswordField from "@/components/PasswordField.svelte";
  import PaperAuthArt from "./PaperAuthArt.svelte";

  const f = useLogin();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void f.submit();
  }
</script>

<div class="page page--auth">
  <div class="auth">
    <PaperAuthArt poem={["见字如面", "展信安好"]} src="写信的人，在等回信的你" seal="信" />
    <section class="auth__main">
      <div class="auth__card">
        <div class="overline"><i></i>Sign in</div>
        <h1 class="h1">欢迎回来</h1>
        <p class="lede">你留给未来的信，还在等你开启。</p>
        {#if f.redirect}
          <p class="note note--inline">
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
            autocomplete="current-password"
            placeholder="输入密码"
            hint="忘记密码？当前版本暂不支持找回。"
            error={f.errors.password}
            testId="login-password"
          />
          <div class="form__err" role="alert" data-testid={f.errors.form ? "login-error" : undefined}>{f.errors.form}</div>
          <button class={["btn", "btn--primary", "btn--lg", "btn--block", f.busy && "is-busy"]} type="submit" disabled={f.busy} data-testid="login-submit">
            <span>{f.busy ? "登录中…" : "登录"}</span>
            <AppIcon name="arrow" class="ic--go" />
          </button>
        </form>
        <p class="auth__alt">
          还没有账号？
          <a class="link" href={withRedirect("/register", f.redirect)} data-testid="to-register">注册一个</a>
        </p>
      </div>
    </section>
  </div>
</div>
