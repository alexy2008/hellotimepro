import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "@/api/client";
import { ApiError, type CapsuleRecommendation } from "@/types";
import { Alert } from "@/components/Alert";
import { RecommendationStrip } from "@/components/RecommendationStrip";
import { isoToLocalInput, localInputToIso } from "@/utils/format";

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

export function CreatePage() {
  const navigate = useNavigate();

  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [openLocal, setOpenLocal] = createSignal(presetTime("1h"));
  const [inPlaza, setInPlaza] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal<string | null>(null);
  const [aiBusy, setAiBusy] = createSignal(false);
  const [aiInfo, setAiInfo] = createSignal<string | null>(null);
  const [aiGenerated, setAiGenerated] = createSignal(false);

  // AI 推荐主题：进入页面异步加载，拿到数据后才插入页面；失败则静默
  const [recos, setRecos] = createSignal<CapsuleRecommendation[]>([]);
  const [recoBusy, setRecoBusy] = createSignal(false);
  let recoSeq = 0;

  const contentLen = () => content().length;

  // 直接传入标题，避开 setTitle 的异步性（点击推荐时需要立刻用新标题生成）
  async function runAiGenerate(rawTitle: string) {
    const t = rawTitle.trim();
    const autoTitle = !t;
    setErr(null);
    setAiInfo(null);
    setAiBusy(true);
    try {
      const s = await api.suggestCapsule({ title: t || undefined });
      setContent(s.content);
      setOpenLocal(isoToLocalInput(s.openAt));
      setAiGenerated(true);
      // 仅当本次是空标题模式、且当前标题仍为空时回填，避免覆盖用户已输入的字
      if (s.title && autoTitle) {
        setTitle((cur) => (cur.trim() ? cur : s.title!));
      }
      const days = s.openInDays;
      const source =
        s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      const titleNote =
        s.title && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
      setAiInfo(`${titleNote}，建议 ${days} 天后开启 · 来源：${source}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "AI 生成失败，请稍后重试");
    } finally {
      setAiBusy(false);
    }
  }

  function aiGenerate() {
    void runAiGenerate(title());
  }

  async function loadRecos() {
    const seq = ++recoSeq;
    setRecoBusy(true);
    try {
      const list = await api.capsuleRecommendations({ count: 4 });
      if (seq !== recoSeq) return; // 丢弃过期响应
      // 空数组表示本次后端 LLM 不可用：保留已有推荐，不要把已显示的内容清空
      if (list.items.length > 0) setRecos(list.items);
    } catch {
      // 推荐是锦上添花：失败时静默，保留已有数据（首次失败则保持不显示）
    } finally {
      if (seq === recoSeq) setRecoBusy(false);
    }
  }

  onMount(() => {
    void loadRecos();
  });

  function pickReco(reco: CapsuleRecommendation) {
    setTitle(reco.title);
    setContent("");
    setAiGenerated(false);
    void runAiGenerate(reco.title);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const created = await api.createCapsule({
        title: title().trim(),
        content: content(),
        openAt: localInputToIso(openLocal()),
        inPlaza: inPlaza(),
      });
      navigate(`/c/${created.code}`, { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      class="cy-container cy-container--narrow"
      style={{ "margin-top": "var(--space-10)", "margin-bottom": "var(--space-16)" }}
    >
      <div style={{ "max-width": "720px", margin: "0 auto" }}>
        <h1
          style={{
            "font-family": "var(--font-display)",
            "font-size": "var(--font-size-4xl)",
            margin: "0 0 var(--space-2)",
          }}
        >
          写给未来的信
        </h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-8)" }}>
          这段文字会被上锁，直到你设定的时刻才能由任何人 —— 包括你自己 —— 开启。
        </p>

        <form class="cy-form" onSubmit={submit}>
          <div class="cy-field">
            <label for="title">
              标题{" "}
              <span style={{ color: "var(--color-text-muted)", "font-weight": "400" }}>
                · 最多 60 字
              </span>
            </label>
            <div style={{ display: "flex", gap: "var(--space-2)", "align-items": "stretch" }}>
              <input
                class="cy-input"
                id="title"
                type="text"
                maxlength={60}
                required
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                style={{ flex: "1" }}
              />
              <button
                type="button"
                class="cy-btn cy-btn--ghost"
                onClick={aiGenerate}
                disabled={aiBusy()}
                title="让 AI 生成胶囊正文与建议开启时间；标题留空时会顺便起个标题"
                style={{ "white-space": "nowrap" }}
              >
                {aiBusy() ? "生成中…" : aiGenerated() ? "✨ 重新生成" : "✨ AI 生成"}
              </button>
            </div>
            <Show when={aiInfo()}>
              <span class="cy-field__hint" style={{ color: "var(--color-text-secondary)" }}>
                {aiInfo()}
              </span>
            </Show>
          </div>

          <Show when={!title().trim() && recos().length > 0}>
            <RecommendationStrip
              recos={recos()}
              busy={recoBusy()}
              disabled={aiBusy()}
              onPick={pickReco}
              onRefresh={() => void loadRecos()}
            />
          </Show>

          <div class="cy-field">
            <label for="content">
              内容{" "}
              <span style={{ color: "var(--color-text-muted)", "font-weight": "400" }}>
                · 最多 5000 字
              </span>
            </label>
            <textarea
              class="cy-textarea"
              id="content"
              rows={10}
              maxlength={5000}
              required
              value={content()}
              onInput={(e) => setContent(e.currentTarget.value)}
              placeholder={
                "在这里写下你想传递到未来的话。建议：\n- 具体的场景 / 情绪 / 正在读的书\n- 一个小小的许诺\n- 或只是一句：嘿，还活着吗？"
              }
            />
            <span class="cy-field__hint">
              <span style={{ color: "var(--color-text-secondary)" }}>{contentLen()}</span> / 5000
            </span>
          </div>

          <div class="cy-field">
            <label for="open_at">
              开启时间{" "}
              <span style={{ color: "var(--color-text-muted)", "font-weight": "400" }}>
                · 最早 60 秒后
              </span>
            </label>
            <input
              class="cy-input"
              id="open_at"
              type="datetime-local"
              required
              value={openLocal()}
              onInput={(e) => setOpenLocal(e.currentTarget.value)}
            />
            <span class="cy-field__hint">时区以你当前所在时区为准，提交时会转换为 UTC。</span>
          </div>

          <div class="cy-field">
            <label>可见性</label>
            <label class="cy-toggle">
              <input
                type="checkbox"
                checked={inPlaza()}
                onChange={(e) => setInPlaza(e.currentTarget.checked)}
              />
              <span class="cy-toggle__track" />
              <span class="cy-toggle__body">
                <span class="cy-toggle__label">发布到胶囊广场</span>
                <span class="cy-toggle__hint">
                  开启后，胶囊标题和倒计时将对所有人可见；关闭后仅持有胶囊码的人可访问。
                </span>
              </span>
            </label>
          </div>

          <div class="cy-field">
            <label>快速预设</label>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "var(--space-2)" }}>
              <button
                type="button"
                class="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("1m"))}
              >
                1 分钟后（测试）
              </button>
              <button
                type="button"
                class="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("1h"))}
              >
                1 小时后
              </button>
              <button
                type="button"
                class="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("tomorrow9"))}
              >
                明天早上 9:00
              </button>
              <button
                type="button"
                class="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("1y"))}
              >
                1 年后
              </button>
              <button
                type="button"
                class="cy-btn cy-btn--ghost cy-btn--sm"
                onClick={() => setOpenLocal(presetTime("y2030"))}
              >
                2030.01.01
              </button>
            </div>
          </div>

          <Alert variant="info">
            上锁后不可编辑、不可提前开启；可以在"我创建的"列表里随时撤回（删除）。
          </Alert>

          <Show when={err()}>
            <Alert variant="danger">{err()}</Alert>
          </Show>

          <div style={{ display: "flex", gap: "var(--space-3)", "justify-content": "flex-end" }}>
            <button type="button" class="cy-btn cy-btn--ghost" onClick={() => navigate(-1)}>
              取消
            </button>
            <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" disabled={busy()}>
              {busy() ? "封存中…" : "🔒 上锁封存"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
