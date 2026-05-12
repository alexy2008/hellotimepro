"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CapsuleCodeInput } from "@/components/capsule-code-input";
import { Alert } from "@/components/alert";
import { api } from "@/lib/api-client";
import { ApiError } from "@/types";

export default function OpenPage() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function open(c: string) {
    if (c.length !== 8) return;
    setErr(null);
    setBusy(true);
    try {
      const cap = await api.capsuleByCode(c);
      router.push(`/c/${cap.code}`);
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
      if (filtered.length === 8) void open(filtered);
    } catch {
      setErr("粘贴失败：请允许浏览器访问剪贴板");
    }
  }

  return (
    <main className="cy-container">
      <div className="cy-open-center">
        <h1>用 8 位密钥开启胶囊</h1>
        <p>输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。</p>

        <div style={{ marginBottom: "var(--space-8)" }}>
          <CapsuleCodeInput value={code} onChange={setCode} onComplete={open} />
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="cy-btn cy-btn--primary cy-btn--lg"
            onClick={() => open(code)}
            disabled={busy || code.length !== 8}
          >
            {busy ? "查询中…" : "开启 →"}
          </button>
          <button type="button" className="cy-btn cy-btn--ghost cy-btn--lg" onClick={paste}>
            粘贴识别
          </button>
        </div>

        <div
          style={{
            marginTop: "var(--space-10)",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <span>
              💡 可用{" "}
              <code
                style={{
                  background: "var(--color-surface-2)",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
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

      {err && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <Alert variant="danger">{err}</Alert>
        </div>
      )}
    </main>
  );
}
