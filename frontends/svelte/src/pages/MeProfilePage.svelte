<script lang="ts">
  import { api } from "@/api/client";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { ApiError, type Avatar } from "@/types";
  import AvatarPicker from "@/components/AvatarPicker.svelte";
  import Alert from "@/components/Alert.svelte";

  let avatars = $state<Avatar[]>([]);
  let nickname = $state(authStore.user?.nickname ?? "");
  let avatarId = $state<string | null>(authStore.user?.avatarId ?? null);
  let profileBusy = $state(false);
  let profileMsg = $state<{ type: "info" | "success" | "danger"; text: string } | null>(null);

  let oldPwd = $state("");
  let newPwd = $state("");
  let confirmPwd = $state("");
  let pwdBusy = $state(false);
  let pwdMsg = $state<{ type: "success" | "danger"; text: string } | null>(null);

  $effect(() => {
    void (async () => {
      try {
        avatars = await api.avatars();
      } catch {
        /* noop */
      }
    })();
  });

  // 当 authStore.user 异步加载到位后，同步表单初值
  let lastUserId: string | undefined;
  $effect(() => {
    const u = authStore.user;
    if (u && u.id !== lastUserId) {
      lastUserId = u.id;
      nickname = u.nickname;
      avatarId = u.avatarId;
    }
  });

  async function saveProfile(e: SubmitEvent) {
    e.preventDefault();
    profileMsg = null;
    profileBusy = true;
    try {
      const u = authStore.user;
      const patch: { nickname?: string; avatarId?: string } = {};
      if (u && nickname !== u.nickname) patch.nickname = nickname.trim();
      if (u && avatarId && avatarId !== u.avatarId) patch.avatarId = avatarId;
      if (Object.keys(patch).length === 0) {
        profileMsg = { type: "info", text: "没有改动" };
        return;
      }
      await api.updateProfile(patch);
      await authStore.refreshMe();
      profileMsg = { type: "success", text: "已保存" };
    } catch (e2) {
      profileMsg = {
        type: "danger",
        text: e2 instanceof ApiError ? e2.message : "保存失败",
      };
    } finally {
      profileBusy = false;
    }
  }

  async function changePassword(e: SubmitEvent) {
    e.preventDefault();
    pwdMsg = null;
    if (newPwd !== confirmPwd) {
      pwdMsg = { type: "danger", text: "两次输入的新密码不一致" };
      return;
    }
    pwdBusy = true;
    try {
      await api.changePassword({ currentPassword: oldPwd, newPassword: newPwd });
      pwdMsg = { type: "success", text: "密码已更新，3 秒后将自动登出。" };
      oldPwd = "";
      newPwd = "";
      confirmPwd = "";
      setTimeout(async () => {
        await authStore.logout(false);
        window.location.assign("/login");
      }, 3000);
    } catch (e2) {
      pwdMsg = {
        type: "danger",
        text: e2 instanceof ApiError ? e2.message : "修改失败",
      };
    } finally {
      pwdBusy = false;
    }
  }

  function resetProfile() {
    if (authStore.user) {
      nickname = authStore.user.nickname;
      avatarId = authStore.user.avatarId;
    }
  }
</script>

<h1>账号设置</h1>

<div class="cy-card" style:margin-bottom="var(--space-6)">
  <h2 style:font-size="var(--font-size-xl)" style:margin="0 0 var(--space-5)" style:font-family="var(--font-display)">
    基本信息
  </h2>
  <form class="cy-form" onsubmit={saveProfile}>
    <div class="cy-field">
      <label>邮箱</label>
      <input class="cy-input" value={authStore.user?.email ?? ""} disabled />
      <span class="cy-field__hint">邮箱作为登录账号不可修改。</span>
    </div>
    <div class="cy-field">
      <label for="nick">昵称</label>
      <input id="nick" class="cy-input" maxlength="20" bind:value={nickname} />
    </div>
    <div class="cy-field">
      <label>头像</label>
      <AvatarPicker {avatars} value={avatarId} onChange={(id) => (avatarId = id)} />
    </div>

    {#if profileMsg}
      <Alert variant={profileMsg.type}>{profileMsg.text}</Alert>
    {/if}

    <div style:display="flex" style:gap="var(--space-3)" style:justify-content="flex-end">
      <button type="button" class="cy-btn cy-btn--ghost" onclick={resetProfile}>重置</button>
      <button class="cy-btn cy-btn--primary" type="submit" disabled={profileBusy}>
        {profileBusy ? "保存中…" : "保存更改"}
      </button>
    </div>
  </form>
</div>

<div class="cy-card" style:margin-bottom="var(--space-6)">
  <h2 style:font-size="var(--font-size-xl)" style:margin="0 0 var(--space-5)" style:font-family="var(--font-display)">
    修改密码
  </h2>
  <form class="cy-form" onsubmit={changePassword}>
    <div class="cy-field">
      <label for="oldPwd">当前密码</label>
      <input id="oldPwd" class="cy-input" type="password" required bind:value={oldPwd} />
    </div>
    <div class="cy-field">
      <label for="newPwd">新密码</label>
      <input id="newPwd" class="cy-input" type="password" required minlength="8" bind:value={newPwd} />
      <span class="cy-field__hint">
        至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。
      </span>
    </div>
    <div class="cy-field">
      <label for="confirmPwd">确认新密码</label>
      <input id="confirmPwd" class="cy-input" type="password" required minlength="8" bind:value={confirmPwd} />
    </div>

    {#if pwdMsg}
      <Alert variant={pwdMsg.type}>{pwdMsg.text}</Alert>
    {/if}

    <div style:display="flex" style:justify-content="flex-end">
      <button class="cy-btn cy-btn--primary" type="submit" disabled={pwdBusy}>
        {pwdBusy ? "更新中…" : "更新密码"}
      </button>
    </div>
  </form>
</div>
