import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Alert } from "@/components/Alert";

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuth((s) => s.setTokens);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .avatars()
      .then((list) => {
        setAvatars(list);
        if (list.length > 0) setAvatarId(list[0].id);
      })
      .catch(() => {
        setErr("拉取头像列表失败，请检查后端是否已启动");
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!avatarId) {
      setErr("请选择一个头像");
      return;
    }
    setBusy(true);
    try {
      const tokens = await api.register({
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        avatarId,
      });
      setTokens(tokens);
      navigate("/create", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="cy-container cy-container--narrow"
      style={{ marginTop: "var(--space-12)", marginBottom: "var(--space-16)" }}
    >
      <div className="cy-card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-3xl)",
            margin: "0 0 var(--space-2)",
          }}
        >
          注册新身份
        </h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-8)" }}>
          选一个赛博头像、写一封最早 60 秒后才能打开的信。
        </p>

        <form className="cy-form" onSubmit={submit}>
          <div className="cy-field">
            <label htmlFor="email">邮箱</label>
            <input
              className="cy-input"
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="cy-field">
            <label htmlFor="nick">昵称</label>
            <input
              className="cy-input"
              id="nick"
              type="text"
              maxLength={20}
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <span className="cy-field__hint">2–20 字符，注册后可修改。</span>
          </div>
          <div className="cy-field">
            <label htmlFor="pwd">密码</label>
            <input
              className="cy-input"
              id="pwd"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="cy-field__hint">至少 8 位，需包含字母和数字。</span>
          </div>
          <div className="cy-field">
            <label>选择头像（必选）</label>
            <AvatarPicker avatars={avatars} value={avatarId} onChange={setAvatarId} />
            <span className="cy-field__hint">10 个内置头像，不支持上传自定义头像（M1 版本）。</span>
          </div>
          <button
            className="cy-btn cy-btn--primary cy-btn--lg"
            type="submit"
            style={{ width: "100%" }}
            disabled={busy}
          >
            {busy ? "提交中…" : "创建账号并进入创建胶囊"}
          </button>
          <div
            style={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            已有账号？<Link to="/login" style={{ color: "var(--color-brand-primary)" }}>去登录</Link>
          </div>
        </form>
      </div>

      {err && (
        <div style={{ maxWidth: 560, margin: "var(--space-6) auto 0" }}>
          <Alert variant="danger">{err}</Alert>
        </div>
      )}
    </main>
  );
}
