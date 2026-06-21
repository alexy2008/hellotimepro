<script lang="ts">
  import { onMount } from "svelte";
  import { navigate } from "svelte-routing";
  import { api } from "@/api/client";
  import { ApiError, type CapsuleRecommendation } from "@/types";
  import Alert from "@/components/Alert.svelte";
  import DateTimePicker from "@/components/DateTimePicker.svelte";
  import RecommendationStrip from "@/components/RecommendationStrip.svelte";
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
      case "tomorrow9":
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0);
        break;
      case "1y":
        now.setFullYear(now.getFullYear() + 1);
        break;
      case "y2030":
        return "2030-01-01T00:00";
    }
    return isoToLocalInput(now.toISOString());
  }

  let title = $state("");
  let content = $state("");
  let openLocal = $state(presetTime("1h"));
  let inPlaza = $state(true);
  let busy = $state(false);
  let err = $state<string | null>(null);
  let aiBusy = $state(false);
  let aiInfo = $state<string | null>(null);
  let aiGenerated = $state(false);

  // AI 推荐主题：进入页面异步加载，拿到数据后才显示；失败则静默（不占位、不提示）
  let recos = $state<CapsuleRecommendation[]>([]);
  let recoBusy = $state(false);
  let recoSeq = 0; // "换一批"竞态守卫

  const contentLen = $derived(content.length);

  // 直接传入标题，避开响应式更新的时序（点击推荐时需要立刻用新标题生成）
  async function runAiGenerate(rawTitle: string) {
    const t = rawTitle.trim();
    const autoTitle = !t;
    err = null;
    aiInfo = null;
    aiBusy = true;
    try {
      const s = await api.suggestCapsule({ title: t || undefined });
      content = s.content;
      openLocal = isoToLocalInput(s.openAt);
      aiGenerated = true;
      // 仅当本次是空标题模式、且当前标题仍为空时回填，避免覆盖用户已输入的字
      if (s.title && autoTitle && !title.trim()) {
        title = s.title;
      }
      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      const titleNote = s.title && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
      aiInfo = `${titleNote}，建议 ${s.openInDays} 天后开启 · 来源：${source}`;
    } catch (e) {
      err = e instanceof ApiError ? e.message : "AI 生成失败，请稍后重试";
    } finally {
      aiBusy = false;
    }
  }

  function aiGenerate() {
    void runAiGenerate(title);
  }

  async function loadRecos() {
    const seq = ++recoSeq;
    recoBusy = true;
    try {
      const list = await api.capsuleRecommendations({ count: 4 });
      if (seq !== recoSeq) return; // 丢弃过期响应
      // 空数组表示本次 LLM 不可用：保留已有推荐，不要把已显示的清空
      if (list.items.length > 0) recos = list.items;
    } catch {
      // 推荐是锦上添花：失败时静默
    } finally {
      if (seq === recoSeq) recoBusy = false;
    }
  }

  function pickReco(reco: CapsuleRecommendation) {
    title = reco.title;
    content = "";
    aiGenerated = false;
    void runAiGenerate(reco.title);
  }

  onMount(() => {
    void loadRecos();
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    err = null;
    busy = true;
    try {
      const created = await api.createCapsule({
        title: title.trim(),
        content,
        openAt: localInputToIso(openLocal),
        inPlaza,
      });
      navigate(`/capsules/${created.code}`, { replace: true });
    } catch (e2) {
      err = e2 instanceof ApiError ? e2.message : "创建失败";
    } finally {
      busy = false;
    }
  }
</script>

<main
  class="cy-container cy-container--narrow"
  style:margin-top="var(--space-10)"
  style:margin-bottom="var(--space-16)"
>
  <div style:max-width="720px" style:margin="0 auto">
    <h1 style:font-family="var(--font-display)" style:font-size="var(--font-size-4xl)" style:margin="0 0 var(--space-2)">
      写给未来的信
    </h1>
    <p style:color="var(--color-text-secondary)" style:margin="0 0 var(--space-8)">
      这段文字会被上锁，直到你设定的时刻才能由任何人 —— 包括你自己 —— 开启。
    </p>

    <form class="cy-form" onsubmit={submit}>
      <div class="cy-field">
        <label for="title">
          标题
          <span style:color="var(--color-text-muted)" style:font-weight="400">· 最多 60 字</span>
        </label>
        <div style:display="flex" style:gap="var(--space-2)" style:align-items="stretch">
          <input
            id="title"
            class="cy-input"
            type="text"
            maxlength="60"
            required
            style:flex="1"
            bind:value={title}
          />
          <button
            type="button"
            class="cy-btn cy-btn--ghost"
            disabled={aiBusy}
            title="让 AI 生成胶囊正文与建议开启时间；标题留空时会顺便起个标题"
            style:white-space="nowrap"
            onclick={aiGenerate}
          >
            {aiBusy ? "生成中…" : aiGenerated ? "✨ 重新生成" : "✨ AI 生成"}
          </button>
        </div>
        {#if aiInfo}
          <span class="cy-field__hint" style:color="var(--color-text-secondary)">{aiInfo}</span>
        {/if}
      </div>

      {#if !title.trim() && recos.length > 0}
        <RecommendationStrip
          {recos}
          busy={recoBusy}
          disabled={aiBusy}
          onPick={pickReco}
          onRefresh={() => void loadRecos()}
        />
      {/if}

      <div class="cy-field">
        <label for="content">
          内容
          <span style:color="var(--color-text-muted)" style:font-weight="400">· 最多 5000 字</span>
        </label>
        <textarea
          id="content"
          class="cy-textarea"
          rows="10"
          maxlength="5000"
          required
          placeholder={`在这里写下你想传递到未来的话。建议：\n- 具体的场景 / 情绪 / 正在读的书\n- 一个小小的许诺\n- 或只是一句：嘿，还活着吗？`}
          bind:value={content}
        ></textarea>
        <span class="cy-field__hint">
          <span style:color="var(--color-text-secondary)">{contentLen}</span> / 5000
        </span>
      </div>

      <div class="cy-field">
        <label for="open_at">
          开启时间
          <span style:color="var(--color-text-muted)" style:font-weight="400">· 最早 60 秒后</span>
        </label>
        <DateTimePicker id="open_at" bind:value={openLocal} />
        <span class="cy-field__hint">时区以你当前所在时区为准，提交时会转换为 UTC。</span>
        <div class="cy-create-presets">
          <span class="cy-create-presets__label">快速预设</span>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" onclick={() => (openLocal = presetTime("1m"))}>
            1 分钟后（测试）
          </button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" onclick={() => (openLocal = presetTime("1h"))}>
            1 小时后
          </button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" onclick={() => (openLocal = presetTime("tomorrow9"))}>
            明天早上 9:00
          </button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" onclick={() => (openLocal = presetTime("1y"))}>
            1 年后
          </button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" onclick={() => (openLocal = presetTime("y2030"))}>
            2030.01.01
          </button>
        </div>
      </div>

      <Alert variant="info">
        上锁后不可编辑、不可提前开启；可以在"我创建的"列表里随时撤回（删除）。
      </Alert>

      {#if err}
        <Alert variant="danger">{err}</Alert>
      {/if}

      <div class="cy-create-actions">
        <label class="cy-toggle cy-toggle--inline">
          <input type="checkbox" bind:checked={inPlaza} />
          <span class="cy-toggle__track"></span>
          <span class="cy-toggle__label">发布到胶囊广场</span>
        </label>
        <div class="cy-create-actions__buttons">
          <button type="button" class="cy-btn cy-btn--ghost" onclick={() => window.history.back()}>
            取消
          </button>
          <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" disabled={busy}>
            {busy ? "封存中…" : "🔒 上锁封存"}
          </button>
        </div>
      </div>
    </form>
  </div>
</main>
