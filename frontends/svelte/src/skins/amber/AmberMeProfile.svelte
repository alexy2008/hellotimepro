<!-- 「账号设置」：基本信息（昵称、星球头像）+ 修改密码。表单归「我的」路由所有，切皮肤不丢 -->
<script lang="ts">
  import { authStore } from "@/stores/auth.svelte.ts";
  import { AvatarIds, useMe } from "@/state/account.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AvatarPicker from "@/components/AvatarPicker.svelte";
  import FormField from "@/components/FormField.svelte";
  import FormMsg from "@/components/FormMsg.svelte";
  import NickState from "@/components/NickState.svelte";
  import PasswordField from "@/components/PasswordField.svelte";
  import PwdRules from "@/components/PwdRules.svelte";

  const me = useMe();
  const p = me.profile;
  const avatars = new AvatarIds();

  function save(e: SubmitEvent) {
    e.preventDefault();
    void p.saveProfile().then(me.stats.refresh);
  }
  function changePassword(e: SubmitEvent) {
    e.preventDefault();
    void p.changePassword();
  }
</script>

<div class="profile">
  <section class="card card--pad">
    <div class="eyebrow">Profile</div>
    <h2 class="card__title">基本信息</h2>
    <form novalidate onsubmit={save}>
      <FormField id="p-email" value={authStore.user?.email} label="邮箱" type="email" lead="mail" disabled hint="邮箱是登录账号，不可修改。" />
      <FormField
        id="p-nick"
        bind:value={p.nickname}
        label="昵称"
        lead="user"
        autocomplete="nickname"
        hint={p.nickHint ?? "2–20 个字符，全站唯一。"}
        error={p.errors.nickname}
        testId="profile-nickname"
      >
        {#snippet trail()}<NickState state={p.nick} />{/snippet}
      </FormField>
      <div class="field field--plain">
        <div class="field__head"><span class="field__label">头像</span></div>
        <AvatarPicker bind:value={p.avatarId} ids={avatars.ids} />
      </div>
      <FormMsg m={p.msg} />
      <div class="card__act">
        <button class="btn btn--ghost" type="button" onclick={p.resetProfile}>重置</button>
        <button class={["btn", "btn--primary", p.busy && "is-busy"]} type="submit" disabled={p.busy} data-testid="profile-save">
          <span>{p.busy ? "保存中…" : "保存更改"}</span>
        </button>
      </div>
    </form>
  </section>
  <section class="card card--pad">
    <div class="eyebrow">Security</div>
    <h2 class="card__title">修改密码</h2>
    <form novalidate onsubmit={changePassword}>
      <PasswordField id="pw-cur" bind:value={p.current} label="当前密码" lead="lock" autocomplete="current-password" error={p.errors.current} errorKey="current" testId="pwd-current" />
      <PasswordField id="pw-new" bind:value={p.next} label="新密码" lead="key" autocomplete="new-password" error={p.errors.next} errorKey="new" testId="pwd-new" />
      <PwdRules value={p.next} />
      <PasswordField id="pw-again" bind:value={p.confirm} label="再输一次新密码" lead="key" autocomplete="new-password" error={p.errors.confirm} errorKey="confirm" testId="pwd-confirm" />
      <FormMsg m={p.pwdMsg} />
      <p class="tip tip--quiet">
        <AppIcon name="shield" />
        <span>修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</span>
      </p>
      <div class="card__act">
        <button class={["btn", "btn--primary", p.pwdBusy && "is-busy"]} type="submit" disabled={p.pwdBusy} data-testid="pwd-submit">
          <span>{p.pwdBusy ? "更新中…" : "更新密码"}</span>
        </button>
      </div>
    </form>
  </section>
</div>
