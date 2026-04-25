import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Alert } from "@/components/Alert";

export function MeProfilePage() {
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const logout = useAuth((s) => s.logout);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarId, setAvatarId] = useState<string | null>(user?.avatarId ?? null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "info" | "success" | "danger"; text: string } | null>(null);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    api.avatars().then(setAvatars).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setAvatarId(user.avatarId);
    }
  }, [user]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileBusy(true);
    try {
      const patch: { nickname?: string; avatarId?: string } = {};
      if (user && nickname !== user.nickname) patch.nickname = nickname.trim();
      if (user && avatarId && avatarId !== user.avatarId) patch.avatarId = avatarId;
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

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "danger", text: "两次输入的新密码不一致" });
      return;
    }
    setPwdBusy(true);
    try {
      await api.changePassword({ currentPassword: oldPwd, newPassword: newPwd });
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

      <div className="cy-card" style={{ marginBottom: "var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            margin: "0 0 var(--space-5)",
            fontFamily: "var(--font-display)",
          }}
        >
          基本信息
        </h2>
        <form className="cy-form" onSubmit={saveProfile}>
          <div className="cy-field">
            <label>邮箱</label>
            <input className="cy-input" value={user?.email ?? ""} disabled />
            <span className="cy-field__hint">邮箱作为登录账号不可修改。</span>
          </div>
          <div className="cy-field">
            <label htmlFor="nick">昵称</label>
            <input
              className="cy-input"
              id="nick"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div className="cy-field">
            <label>头像</label>
            <AvatarPicker avatars={avatars} value={avatarId} onChange={setAvatarId} />
          </div>

          {profileMsg && <Alert variant={profileMsg.type}>{profileMsg.text}</Alert>}

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="cy-btn cy-btn--ghost"
              onClick={() => {
                if (user) {
                  setNickname(user.nickname);
                  setAvatarId(user.avatarId);
                }
              }}
            >
              重置
            </button>
            <button className="cy-btn cy-btn--primary" type="submit" disabled={profileBusy}>
              {profileBusy ? "保存中…" : "保存更改"}
            </button>
          </div>
        </form>
      </div>

      <div className="cy-card" style={{ marginBottom: "var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            margin: "0 0 var(--space-5)",
            fontFamily: "var(--font-display)",
          }}
        >
          修改密码
        </h2>
        <form className="cy-form" onSubmit={changePassword}>
          <div className="cy-field">
            <label htmlFor="oldPwd">当前密码</label>
            <input
              className="cy-input"
              id="oldPwd"
              type="password"
              required
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
            />
          </div>
          <div className="cy-field">
            <label htmlFor="newPwd">新密码</label>
            <input
              className="cy-input"
              id="newPwd"
              type="password"
              required
              minLength={8}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <span className="cy-field__hint">
              至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。
            </span>
          </div>
          <div className="cy-field">
            <label htmlFor="confirmPwd">确认新密码</label>
            <input
              className="cy-input"
              id="confirmPwd"
              type="password"
              required
              minLength={8}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
          </div>

          {pwdMsg && <Alert variant={pwdMsg.type}>{pwdMsg.text}</Alert>}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="cy-btn cy-btn--primary" type="submit" disabled={pwdBusy}>
              {pwdBusy ? "更新中…" : "更新密码"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
