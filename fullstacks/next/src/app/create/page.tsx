"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { ApiError } from "@/types";
import { Alert } from "@/components/alert";
import { AuthGate } from "@/components/auth-gate";
import { isoToLocalInput, localInputToIso } from "@/lib/format";

function presetTime(spec: "1m" | "1h" | "tomorrow9" | "1y" | "y2030"): string {
  const now = new Date();
  switch (spec) {
    case "1m":
      now.setSeconds(now.getSeconds() + 130);
      break;
    case "1h":
      now.setHours(now.getHours() + 1);
      break;
    case "tomorrow9": {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      break;
    }
    case "1y":
      now.setFullYear(now.getFullYear() + 1);
      break;
    case "y2030":
      return "2030-01-01T00:00";
  }
  return isoToLocalInput(now.toISOString());
}

function CreatePageInner() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [openLocal, setOpenLocal] = useState(presetTime("1h"));
  const [inPlaza, setInPlaza] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);

  const contentLen = useMemo(() => content.length, [content]);

  async function aiGenerate() {
    const t = title.trim();
    if (!t) {
      setErr("请先填写胶囊标题");
      return;
    }
    setErr(null);
    setAiInfo(null);
    setAiBusy(true);
    try {
      const s = await api.suggestCapsule({ title: t });
      setContent(s.content);
      setOpenLocal(isoToLocalInput(s.openAt));
      setAiGenerated(true);
      const days = s.openInDays;
      const source =
        s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      setAiInfo(`已为你生成正文，建议 ${days} 天后开启 · 来源：${source}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "AI 生成失败，请稍后重试");
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const created = await api.createCapsule({
        title: title.trim(),
        content,
        openAt: localInputToIso(openLocal),
        inPlaza,
      });
      router.replace(`/c/${created.code}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="cy-container cy-container--narrow"
      style={{ marginTop: "var(--space-10)", marginBottom: "var(--space-16)" }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-4xl)",
            margin: "0 0 var(--space-2)",
          }}
        >
          写给未来的信
        </h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-8)" }}>
          这段文字会被上锁，直到你设定的时刻才能由任何人 —— 包括你自己 —— 开启。
        </p>

        <form className="cy-form" onSubmit={submit}>
          <div className="cy-field">
            <label htmlFor="title">
              标题{" "}
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>· 最多 60 字</span>
            </label>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "stretch" }}>
              <input
                className="cy-input"
                id="title"
                type="text"
                maxLength={60}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="cy-btn cy-btn--ghost"
                onClick={aiGenerate}
                disabled={aiBusy || !title.trim()}
                title="基于标题，让 AI 生成胶囊正文与建议开启时间"
                style={{ whiteSpace: "nowrap" }}
              >
                {aiBusy ? "生成中…" : aiGenerated ? "✨ 重新生成" : "✨ AI 生成"}
              </button>
            </div>
            {aiInfo && (
              <span className="cy-field__hint" style={{ color: "var(--color-text-secondary)" }}>
                {aiInfo}
              </span>
            )}
          </div>

          <div className="cy-field">
            <label htmlFor="content">
              内容{" "}
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>· 最多 5000 字</span>
            </label>
            <textarea
              className="cy-textarea"
              id="content"
              rows={10}
              maxLength={5000}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                "在这里写下你想传递到未来的话。建议：\n- 具体的场景 / 情绪 / 正在读的书\n- 一个小小的许诺\n- 或只是一句：嘿，还活着吗？"
              }
            />
            <span className="cy-field__hint">
              <span style={{ color: "var(--color-text-secondary)" }}>{contentLen}</span> / 5000
            </span>
          </div>

          <div className="cy-field">
            <label htmlFor="open_at">
              开启时间{" "}
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>· 最早 60 秒后</span>
            </label>
            <input
              className="cy-input"
              id="open_at"
              type="datetime-local"
              required
              value={openLocal}
              onChange={(e) => setOpenLocal(e.target.value)}
            />
            <span className="cy-field__hint">
              时区以你当前所在时区为准，提交时会转换为 UTC。
            </span>
          </div>

          <div className="cy-field">
            <label>可见性</label>
            <label className="cy-toggle">
              <input
                type="checkbox"
                checked={inPlaza}
                onChange={(e) => setInPlaza(e.target.checked)}
              />
              <span className="cy-toggle__track" />
              <span className="cy-toggle__body">
                <span className="cy-toggle__label">发布到胶囊广场</span>
                <span className="cy-toggle__hint">
                  开启后，胶囊标题和倒计时将对所有人可见；关闭后仅持有胶囊码的人可访问。
                </span>
              </span>
            </label>
          </div>

          <div className="cy-field">
            <label>快速预设</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <button
                type="button"
                className="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("1m"))}
              >
                1 分钟后（测试）
              </button>
              <button
                type="button"
                className="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("1h"))}
              >
                1 小时后
              </button>
              <button
                type="button"
                className="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("tomorrow9"))}
              >
                明天早上 9:00
              </button>
              <button
                type="button"
                className="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("1y"))}
              >
                1 年后
              </button>
              <button
                type="button"
                className="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("y2030"))}
              >
                2030.01.01
              </button>
            </div>
          </div>

          <Alert variant="info">
            上锁后不可编辑、不可提前开启；可以在&quot;我创建的&quot;列表里随时撤回（删除）。
          </Alert>

          {err && <Alert variant="danger">{err}</Alert>}

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="cy-btn cy-btn--ghost"
              onClick={() => router.back()}
            >
              取消
            </button>
            <button className="cy-btn cy-btn--primary cy-btn--lg" type="submit" disabled={busy}>
              {busy ? "封存中…" : "🔒 上锁封存"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function CreatePage() {
  return (
    <AuthGate>
      <CreatePageInner />
    </AuthGate>
  );
}
