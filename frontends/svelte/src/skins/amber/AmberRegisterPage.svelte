<!-- 「琥珀」注册（/register）：挑一颗星球当头像 -->
<script lang="ts">
  import { AvatarIds, useRegister, withRedirect } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AvatarPicker from "@/components/AvatarPicker.svelte";
  import FormField from "@/components/FormField.svelte";
  import NickState from "@/components/NickState.svelte";
  import PasswordField from "@/components/PasswordField.svelte";
  import PwdRules from "@/components/PwdRules.svelte";
  import AmberAuthArt from "./AmberAuthArt.svelte";

  const f = useRegister();
  const avatars = new AvatarIds();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void f.submit();
  }
</script>

<div class="page page--auth">
  <div class="container auth">
    <div class="auth__card auth__card--wide card">
      <AmberAuthArt state="opened" />
      <div class="eyebrow eyebrow--center">Create account</div>
      <h1 class="page-title">领一个身份</h1>
      <p class="page-lead">挑一颗星球当头像，然后写下你的第一枚胶囊。</p>
      <form novalidate {onsubmit}>
        <div class="form__row">
          <FormField
            id="email"
            bind:value={f.email}
            label="邮箱"
            type="email"
            lead="mail"
            req
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
            lead="user"
            req
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
          lead="lock"
          req
          autocomplete="new-password"
          placeholder="设置密码"
          error={f.errors.password}
          testId="register-password"
        />
        <PwdRules value={f.password} />
        <div class="field field--plain">
          <div class="field__head">
            <span class="field__label">头像 <em>*</em></span>
            <span class="field__count">十选一，不支持上传</span>
          </div>
          <AvatarPicker bind:value={f.avatarId} ids={avatars.ids} />
        </div>
        <div class="form__err" role="alert">{f.errors.form ?? f.errors.avatarId}</div>
        <button class={["btn", "btn--primary", "btn--lg", "btn--block", f.busy && "is-busy"]} type="submit" disabled={f.busy} data-testid="register-submit">
          <span>{f.busy ? "正在创建…" : "创建账号，开始写胶囊"}</span>
          <AppIcon name="arrow" />
        </button>
      </form>
      <p class="auth__alt">
        已经有账号？
        <a href={withRedirect("/login", f.redirect)} data-testid="to-login">去登录</a>
      </p>
    </div>
  </div>
</div>
