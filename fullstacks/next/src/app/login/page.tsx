"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { Alert } from "@/components/alert";
import { ApiError } from "@/types";

/**
 * 校验登录后跳转目标，防御 open redirect。
 *
 * 仅接受：以单 "/" 开头、第二字符不是 "/" 或 "\\" 的本地路径。
 * 拒绝示例：`//evil.example`、`/\evil.example`、`https://evil.example`、`javascript:...`
 *
 * 任何接受 ?next= 的实现都应该这样校验，而不是直接 router.replace(rawNext)。
 */
function safeNext(raw: string | null): string {
  const DEFAULT = "/me/created";
  if (!raw) return DEFAULT;
  if (raw.length < 2 || raw[0] !== "/") return DEFAULT;
  // 拒绝 //... 和 /\... — 浏览器会把它们当作 scheme-relative URL
  if (raw[1] === "/" || raw[1] === "\\") return DEFAULT;
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);

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
      setSession(tokens.user, tokens.accessToken, tokens.refreshToken);
      // 登录后默认跳「我创建的」（与 React 一致）；?next= 优先但**必须**
      // 经过 safeNext 校验，否则 ?next=//evil.example 会被浏览器解读为跨域跳转。
      router.replace(safeNext(params.get("next")));
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
            还没有账号？
            <Link href="/register" style={{ color: "var(--color-brand-primary)" }}>
              立即注册
            </Link>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="cy-container" style={{ padding: "var(--space-10)" }}>
          加载…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
