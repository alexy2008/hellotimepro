import { createSignal, Show } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { api } from "@/api/client";
import { setTokens } from "@/stores/auth";
import { ApiError } from "@/types";
import { Alert } from "@/components/Alert";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const tokens = await api.login({ email: email().trim(), password: password() });
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
      class="cy-container cy-container--narrow"
      style={{ "margin-top": "var(--space-12)", "margin-bottom": "var(--space-16)" }}
    >
      <div class="cy-card" style={{ "max-width": "440px", margin: "0 auto" }}>
        <h1
          style={{
            "font-family": "var(--font-display)",
            "font-size": "var(--font-size-3xl)",
            margin: "0 0 var(--space-2)",
          }}
        >
          欢迎回来
        </h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-8)" }}>
          你留给未来的信，还在等你开启。
        </p>

        <form class="cy-form" onSubmit={submit}>
          <div class="cy-field">
            <label for="email">邮箱</label>
            <input
              class="cy-input"
              id="email"
              type="email"
              autocomplete="email"
              required
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>
          <div class="cy-field">
            <label for="pwd">密码</label>
            <input
              class="cy-input"
              id="pwd"
              type="password"
              autocomplete="current-password"
              required
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <span class="cy-field__hint">忘记密码？M1 暂不支持找回，请联系管理员重置。</span>
          </div>

          <button
            class="cy-btn cy-btn--primary cy-btn--lg"
            type="submit"
            style={{ width: "100%" }}
            disabled={busy()}
          >
            {busy() ? "登录中…" : "登录"}
          </button>

          <div
            style={{
              "text-align": "center",
              color: "var(--color-text-muted)",
              "font-size": "var(--font-size-sm)",
            }}
          >
            还没有账号？
            <A href="/register" style={{ color: "var(--color-brand-primary)" }}>
              立即注册
            </A>
          </div>
        </form>
      </div>

      <Show when={err()}>
        <div style={{ "max-width": "440px", margin: "var(--space-6) auto 0" }}>
          <Alert variant="danger">{err()}</Alert>
        </div>
      </Show>
    </main>
  );
}
