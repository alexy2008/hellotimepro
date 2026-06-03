import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { CapsuleCodeInput } from "@/components/CapsuleCodeInput";
import { Alert } from "@/components/Alert";
import { api } from "@/api/client";
import { ApiError } from "@/types";

export function OpenPage() {
  const [code, setCode] = createSignal("");
  const [err, setErr] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const navigate = useNavigate();

  async function open(c: string) {
    if (c.length !== 8) return;
    setErr(null);
    setBusy(true);
    try {
      const cap = await api.capsuleByCode(c);
      navigate(`/c/${cap.code}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "找不到这条胶囊");
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      const filtered = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      setCode(filtered);
      // 满 8 位时由 CapsuleCodeInput 的 onComplete 触发开启，这里不再主动调用 open，避免重复请求

    } catch {
      setErr("粘贴失败：请允许浏览器访问剪贴板");
    }
  }

  return (
    <main class="cy-container">
      <div class="cy-open-center">
        <h1>用 8 位密钥开启胶囊</h1>
        <p>输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。</p>

        <div style={{ "margin-bottom": "var(--space-8)" }}>
          <CapsuleCodeInput value={code()} onChange={setCode} onComplete={open} />
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            "justify-content": "center",
            "flex-wrap": "wrap",
          }}
        >
          <button
            class="cy-btn cy-btn--primary cy-btn--lg"
            onClick={() => open(code())}
            disabled={busy() || code().length !== 8}
          >
            {busy() ? "查询中…" : "开启 →"}
          </button>
          <button class="cy-btn cy-btn--ghost cy-btn--lg" onClick={paste}>
            粘贴识别
          </button>
        </div>

        <div
          style={{
            "margin-top": "var(--space-10)",
            color: "var(--color-text-muted)",
            "font-size": "var(--font-size-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              "justify-content": "center",
              "flex-wrap": "wrap",
            }}
          >
            <span>
              💡 可用{" "}
              <code
                style={{
                  background: "var(--color-surface-2)",
                  padding: "2px 6px",
                  "border-radius": "var(--radius-sm)",
                }}
              >
                /c/&lt;code&gt;
              </code>{" "}
              直链访问
            </span>
            <span>🔒 未到开启时间的胶囊也会显示倒计时</span>
          </div>
        </div>
      </div>

      <Show when={err()}>
        <div style={{ "max-width": "560px", margin: "0 auto" }}>
          <Alert variant="danger">{err()}</Alert>
        </div>
      </Show>
    </main>
  );
}
