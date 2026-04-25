import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError } from "@/types";
import { Alert } from "@/components/Alert";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuth((s) => s.setTokens);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const tokens = await api.login({ email: email.trim(), password });
      setTokens(tokens);
      const state = location.state as { from?: string } | null;
      navigate(state?.from ?? "/me/created", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="cy-container cy-container--narrow"
      style={{ marginTop: "var(--space-12)", marginBottom: "var(--space-16)" }}
    >
      <div className="cy-card" style={{ maxWidth: 440, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-3xl)",
            margin: "0 0 var(--space-2)",
          }}
        >
          欢迎回来
        </h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-8)" }}>
          你留给未来的信，还在等你开启。
        </p>

        <form className="cy-form" onSubmit={submit}>
          <div className="cy-field">
            <label htmlFor="email">邮箱</label>
            <input
              className="cy-input"
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="cy-field">
            <label htmlFor="pwd">密码</label>
            <input
              className="cy-input"
              id="pwd"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="cy-field__hint">忘记密码？M1 暂不支持找回，请联系管理员重置。</span>
          </div>

          <button
            className="cy-btn cy-btn--primary cy-btn--lg"
            type="submit"
            style={{ width: "100%" }}
            disabled={busy}
          >
            {busy ? "登录中…" : "登录"}
          </button>

          <div
            style={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            还没有账号？<Link to="/register" style={{ color: "var(--color-brand-primary)" }}>立即注册</Link>
          </div>
        </form>
      </div>

      {err && (
        <div style={{ maxWidth: 440, margin: "var(--space-6) auto 0" }}>
          <Alert variant="danger">{err}</Alert>
        </div>
      )}
    </main>
  );
}
