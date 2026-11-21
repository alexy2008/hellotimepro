<!-- 「时笺」注册（/register）：挑一枚邮票当头像 -->
<script lang="ts">
  import { AvatarIds, useRegister, withRedirect } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AvatarPicker from "@/components/AvatarPicker.svelte";
  import FormField from "@/components/FormField.svelte";
  import NickState from "@/components/NickState.svelte";
  import PasswordField from "@/components/PasswordField.svelte";
  import PwdRules from "@/components/PwdRules.svelte";
  import PaperAuthArt from "./PaperAuthArt.svelte";

  const f = useRegister();
  const avatars = new AvatarIds();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void f.submit();
  }
</script>

<div class="page page--auth">
  <div class="auth">
    <PaperAuthArt poem={["纸短情长", "来日方长"]} src="先留个名字，再慢慢写" seal="缄" />
    <section class="auth__main">
      <div class="auth__card auth__card--wide">
        <div class="overline"><i></i>Sign up</div>
        <h1 class="h1">领一个信箱</h1>
        <p class="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>
        <form novalidate {onsubmit}>
          <div class="form__row">
            <FormField
              id="email"
              bind:value={f.email}
              label="邮箱"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              hint="作为登录账号，注册后不可修改。"
              error={f.errors.email}
              testId="register-email"
              autofocus
            />
            <FormField
              id="nickname"
              bind:value={f.nickname}
              label="昵称"
              autocomplete="nickname"
              placeholder="2–20 个字符"
              hint={f.nick.hint ?? "全站唯一，注册后可以改。"}
              error={f.errors.nickname ?? (f.nick.state === "invalid" ? f.nick.hint : undefined)}
              testId="register-nickname"
            >
              {#snippet trail()}<NickState state={f.nick.state} />{/snippet}
            </FormField>
          </div>
          <PasswordField
            id="password"
            bind:value={f.password}
            label="密码"
            autocomplete="new-password"
            placeholder="设置密码"
            error={f.errors.password}
            testId="register-password"
          />
          <PwdRules value={f.password} />
          <div class="field field--plain">
            <span class="field__label">邮票头像 <small>十选一，不支持上传</small></span>
            <AvatarPicker bind:value={f.avatarId} ids={avatars.ids} />
          </div>
          <div class="form__err" role="alert">{f.errors.form ?? f.errors.avatarId}</div>
          <button class={["btn", "btn--primary", "btn--lg", "btn--block", f.busy && "is-busy"]} type="submit" disabled={f.busy} data-testid="register-submit">
            <span>{f.busy ? "正在创建…" : "创建账号，开始写信"}</span>
            <AppIcon name="arrow" class="ic--go" />
          </button>
        </form>
        <p class="auth__alt">
          已经有账号？
          <a class="link" href={withRedirect("/login", f.redirect)} data-testid="to-login">去登录</a>
        </p>
      </div>
    </section>
  </div>
</div>
