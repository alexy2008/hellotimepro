import { createSignal, onMount, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { api } from "@/api/client";
import { setTokens } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Alert } from "@/components/Alert";

export function RegisterPage() {
  const navigate = useNavigate();

  const [avatars, setAvatars] = createSignal<Avatar[]>([]);
  const [email, setEmail] = createSignal("");
  const [nickname, setNickname] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [avatarId, setAvatarId] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);

  onMount(() => {
    api
      .avatars()
      .then((list) => {
        setAvatars(list);
        if (list.length > 0) setAvatarId(list[0].id);
      })
      .catch(() => {
        setErr("拉取头像列表失败，请检查后端是否已启动");
      });
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setErr(null);
    const id = avatarId();
    if (!id) {
      setErr("请选择一个头像");
      return;
    }
    setBusy(true);
    try {
      const tokens = await api.register({
        email: email().trim(),
        password: password(),
        nickname: nickname().trim(),
        avatarId: id,
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
      class="cy-container cy-container--narrow"
      style={{ "margin-top": "var(--space-12)", "margin-bottom": "var(--space-16)" }}
    >
      <div class="cy-card" style={{ "max-width": "560px", margin: "0 auto" }}>
        <h1
          style={{
            "font-family": "var(--font-display)",
            "font-size": "var(--font-size-3xl)",
            margin: "0 0 var(--space-2)",
          }}
        >
          注册新身份
        </h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-8)" }}>
          选一个赛博头像、写一封最早 60 秒后才能打开的信。
        </p>

        <form class="cy-form" onSubmit={submit}>
          <div class="cy-field">
            <label for="email">邮箱</label>
            <input
              class="cy-input"
              id="email"
              type="email"
              required
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>
          <div class="cy-field">
            <label for="nick">昵称</label>
            <input
              class="cy-input"
              id="nick"
              type="text"
              maxlength={20}
              required
              value={nickname()}
              onInput={(e) => setNickname(e.currentTarget.value)}
            />
            <span class="cy-field__hint">2–20 字符，注册后可修改。</span>
          </div>
          <div class="cy-field">
            <label for="pwd">密码</label>
            <input
              class="cy-input"
              id="pwd"
              type="password"
              required
              minlength={8}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <span class="cy-field__hint">至少 8 位，需包含字母和数字。</span>
          </div>
          <div class="cy-field">
            <label>选择头像（必选）</label>
            <AvatarPicker avatars={avatars()} value={avatarId()} onChange={setAvatarId} />
            <span class="cy-field__hint">10 个内置头像，不支持上传自定义头像（M1 版本）。</span>
          </div>
          <button
            class="cy-btn cy-btn--primary cy-btn--lg"
            type="submit"
            style={{ width: "100%" }}
            disabled={busy()}
          >
            {busy() ? "提交中…" : "创建账号并进入创建胶囊"}
          </button>
          <div
            style={{
              "text-align": "center",
              color: "var(--color-text-muted)",
              "font-size": "var(--font-size-sm)",
            }}
          >
            已有账号？
            <A href="/login" style={{ color: "var(--color-brand-primary)" }}>
              去登录
            </A>
          </div>
        </form>
      </div>

      <Show when={err()}>
        <div style={{ "max-width": "560px", margin: "var(--space-6) auto 0" }}>
          <Alert variant="danger">{err()}</Alert>
        </div>
      </Show>
    </main>
  );
}
