import { createEffect, createSignal, onMount, Show } from "solid-js";
import { api } from "@/api/client";
import { auth, refreshMe, logout } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Alert } from "@/components/Alert";

export function MeProfilePage() {
  const [avatars, setAvatars] = createSignal<Avatar[]>([]);
  const [nickname, setNickname] = createSignal(auth.user?.nickname ?? "");
  const [avatarId, setAvatarId] = createSignal<string | null>(auth.user?.avatarId ?? null);
  const [profileBusy, setProfileBusy] = createSignal(false);
  const [profileMsg, setProfileMsg] = createSignal<{
    type: "info" | "success" | "danger";
    text: string;
  } | null>(null);

  const [oldPwd, setOldPwd] = createSignal("");
  const [newPwd, setNewPwd] = createSignal("");
  const [confirmPwd, setConfirmPwd] = createSignal("");
  const [pwdBusy, setPwdBusy] = createSignal(false);
  const [pwdMsg, setPwdMsg] = createSignal<{ type: "success" | "danger"; text: string } | null>(
    null,
  );

  onMount(() => {
    api.avatars().then(setAvatars).catch(() => {});
  });

  // user 到达 / 变化时同步表单初值
  createEffect(() => {
    if (auth.user) {
      setNickname(auth.user.nickname);
      setAvatarId(auth.user.avatarId);
    }
  });

  async function saveProfile(e: SubmitEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileBusy(true);
    try {
      const patch: { nickname?: string; avatarId?: string } = {};
      if (auth.user && nickname() !== auth.user.nickname) patch.nickname = nickname().trim();
      if (auth.user && avatarId() && avatarId() !== auth.user.avatarId) {
        patch.avatarId = avatarId()!;
      }
      if (Object.keys(patch).length === 0) {
        setProfileMsg({ type: "info", text: "没有改动" });
        return;
      }
      await api.updateProfile(patch);
      await refreshMe();
      setProfileMsg({ type: "success", text: "已保存" });
    } catch (e) {
      setProfileMsg({
        type: "danger",
        text: e instanceof ApiError ? e.message : "保存失败",
      });
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e: SubmitEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd() !== confirmPwd()) {
      setPwdMsg({ type: "danger", text: "两次输入的新密码不一致" });
      return;
    }
    setPwdBusy(true);
    try {
      await api.changePassword({ currentPassword: oldPwd(), newPassword: newPwd() });
      setPwdMsg({ type: "success", text: "密码已更新，3 秒后将自动登出。" });
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => {
        void logout(false).then(() => window.location.assign("/login"));
      }, 3000);
    } catch (e) {
      setPwdMsg({
        type: "danger",
        text: e instanceof ApiError ? e.message : "修改失败",
      });
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <>
      <h1>账号设置</h1>

      <div class="cy-card" style={{ "margin-bottom": "var(--space-6)" }}>
        <h2
          style={{
            "font-size": "var(--font-size-xl)",
            margin: "0 0 var(--space-5)",
            "font-family": "var(--font-display)",
          }}
        >
          基本信息
        </h2>
        <form class="cy-form" onSubmit={saveProfile}>
          <div class="cy-field">
            <label>邮箱</label>
            <input class="cy-input" value={auth.user?.email ?? ""} disabled />
            <span class="cy-field__hint">邮箱作为登录账号不可修改。</span>
          </div>
          <div class="cy-field">
            <label for="nick">昵称</label>
            <input
              class="cy-input"
              id="nick"
              maxlength={20}
              value={nickname()}
              onInput={(e) => setNickname(e.currentTarget.value)}
            />
          </div>
          <div class="cy-field">
            <label>头像</label>
            <AvatarPicker avatars={avatars()} value={avatarId()} onChange={setAvatarId} />
          </div>

          <Show when={profileMsg()}>
            {(msg) => <Alert variant={msg().type}>{msg().text}</Alert>}
          </Show>

          <div
            style={{ display: "flex", gap: "var(--space-3)", "justify-content": "flex-end" }}
          >
            <button
              type="button"
              class="cy-btn cy-btn--ghost"
              onClick={() => {
                if (auth.user) {
                  setNickname(auth.user.nickname);
                  setAvatarId(auth.user.avatarId);
                }
              }}
            >
              重置
            </button>
            <button class="cy-btn cy-btn--primary" type="submit" disabled={profileBusy()}>
              {profileBusy() ? "保存中…" : "保存更改"}
            </button>
          </div>
        </form>
      </div>

      <div class="cy-card" style={{ "margin-bottom": "var(--space-6)" }}>
        <h2
          style={{
            "font-size": "var(--font-size-xl)",
            margin: "0 0 var(--space-5)",
            "font-family": "var(--font-display)",
          }}
        >
          修改密码
        </h2>
        <form class="cy-form" onSubmit={changePassword}>
          <div class="cy-field">
            <label for="oldPwd">当前密码</label>
            <input
              class="cy-input"
              id="oldPwd"
              type="password"
              required
              value={oldPwd()}
              onInput={(e) => setOldPwd(e.currentTarget.value)}
            />
          </div>
          <div class="cy-field">
            <label for="newPwd">新密码</label>
            <input
              class="cy-input"
              id="newPwd"
              type="password"
              required
              minlength={8}
              value={newPwd()}
              onInput={(e) => setNewPwd(e.currentTarget.value)}
            />
            <span class="cy-field__hint">
              至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。
            </span>
          </div>
          <div class="cy-field">
            <label for="confirmPwd">确认新密码</label>
            <input
              class="cy-input"
              id="confirmPwd"
              type="password"
              required
              minlength={8}
              value={confirmPwd()}
              onInput={(e) => setConfirmPwd(e.currentTarget.value)}
            />
          </div>

          <Show when={pwdMsg()}>
            {(msg) => <Alert variant={msg().type}>{msg().text}</Alert>}
          </Show>

          <div style={{ display: "flex", "justify-content": "flex-end" }}>
            <button class="cy-btn cy-btn--primary" type="submit" disabled={pwdBusy()}>
              {pwdBusy() ? "更新中…" : "更新密码"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
