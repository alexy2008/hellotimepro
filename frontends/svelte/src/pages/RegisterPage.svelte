<script lang="ts">
  import { link, navigate } from "svelte-routing";
  import { api } from "@/api/client";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { ApiError, type Avatar } from "@/types";
  import AvatarPicker from "@/components/AvatarPicker.svelte";
  import Alert from "@/components/Alert.svelte";

  // 已登录用户访问注册页 → 直接跳首页
  $effect(() => {
    if (authStore.hydrated && authStore.user) {
      navigate("/", { replace: true });
    }
  });

  let avatars = $state<Avatar[]>([]);
  let email = $state("");
  let nickname = $state("");
  let password = $state("");
  let avatarId = $state<string | null>(null);
  let busy = $state(false);
  let err = $state<string | null>(null);

  $effect(() => {
    void (async () => {
      try {
        const list = await api.avatars();
        avatars = list;
        if (list.length > 0) avatarId = list[0].id;
      } catch {
        err = "拉取头像列表失败，请检查后端是否已启动";
      }
    })();
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    err = null;
    if (!avatarId) {
      err = "请选择一个头像";
      return;
    }
    busy = true;
    try {
      const tokens = await api.register({
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        avatarId,
      });
      authStore.setTokens(tokens);
      navigate("/create", { replace: true });
    } catch (e2) {
      err = e2 instanceof ApiError ? e2.message : "注册失败";
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
  <div class="cy-card" style:max-width="560px" style:margin="0 auto">
    <h1 style:font-family="var(--font-display)" style:font-size="var(--font-size-3xl)" style:margin="0 0 var(--space-2)">
      注册新身份
    </h1>
    <p style:color="var(--color-text-secondary)" style:margin="0 0 var(--space-8)">
      选一个赛博头像、写一封最早 60 秒后才能打开的信。
    </p>

    <form class="cy-form" onsubmit={submit}>
      <div class="cy-field">
        <label for="email">邮箱</label>
        <input id="email" class="cy-input" type="email" required bind:value={email} />
      </div>
      <div class="cy-field">
        <label for="nick">昵称</label>
        <input id="nick" class="cy-input" type="text" maxlength="20" required bind:value={nickname} />
        <span class="cy-field__hint">2–20 字符，注册后可修改。</span>
      </div>
      <div class="cy-field">
        <label for="pwd">密码</label>
        <input id="pwd" class="cy-input" type="password" required minlength="8" bind:value={password} />
        <span class="cy-field__hint">至少 8 位，需包含字母和数字。</span>
      </div>
      <div class="cy-field">
        <label>选择头像（必选）</label>
        <AvatarPicker {avatars} value={avatarId} onChange={(id) => (avatarId = id)} />
        <span class="cy-field__hint">10 个内置头像，不支持上传自定义头像（M1 版本）。</span>
      </div>
      <button
        class="cy-btn cy-btn--primary cy-btn--lg"
        type="submit"
        style:width="100%"
        disabled={busy}
      >
        {busy ? "提交中…" : "创建账号并进入创建胶囊"}
      </button>
      <div
        style:text-align="center"
        style:color="var(--color-text-muted)"
        style:font-size="var(--font-size-sm)"
      >
        已有账号？
        <a href="/login" use:link style:color="var(--color-brand-primary)">去登录</a>
      </div>
    </form>
  </div>

  {#if err}
    <div style:max-width="560px" style:margin="var(--space-6) auto 0">
      <Alert variant="danger">{err}</Alert>
    </div>
  {/if}
</main>
