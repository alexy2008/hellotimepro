// ============================================================
// 创建页的共享逻辑（两套皮肤共用）
// - 草稿：标题 / 正文 / 开启时刻 / 是否公开，放在模块级 store 里，
//   切换皮肤、离开再回来都接着写；封存成功、登出、换了账号时清空（草稿属于写它的那个人）
// - 校验：文案以 spec/ui/copy.md 为准
// - AI：推荐主题（序号守卫防乱序、空列表不覆盖已有推荐）、代笔（打字机效果，可被打断）
// - 封存：调接口，返回胶囊给皮肤展示回执
//
// createCapsuleForm() 由创建路由（按账号重建）调用一次：提交锁、AI 任务、成功回执都归它，
// 切皮肤只换视图，正在封存的请求仍由同一份状态接收。
// ============================================================

import { batch, createMemo, createSignal, onCleanup } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail, type CapsuleRecommendation } from "@/types";
import { addCalendarYears, fmt, reducedMotion, sleep } from "@/lib/fmt";
import { toast } from "@/stores/feedback";
import { onAccountChange } from "@/stores/auth";

export const DAY = 86400000;

/**
 * 开启时间上下限：晚于此刻 + 61 秒；不晚于「此刻往后 10 个日历年」（openapi 2.0.0，与服务端同一算法），
 * 两头各留一点余量，避免与服务端的时钟、时区差撞线
 */
export const LIMITS = {
  minOpen: () => Date.now() + 61 * 1000,
  maxOpen: () => addCalendarYears(Date.now(), 10) - 5 * 60 * 1000,
};

export const MSG = {
  title: "先给这枚胶囊起个标题",
  content: "还没写内容呢，写点什么吧",
  openMissing: "请选择完整的开启日期和时间",
  openMin: "开启时间至少要在 1 分钟之后",
  openMax: "开启时间不能超过 10 年",
};

const atNine = (d: Date) => {
  d.setHours(9, 0, 0, 0);
  return d.getTime();
};
const shift = (fn: (d: Date) => void) => () => {
  const d = new Date();
  fn(d);
  return atNine(d);
};

/** 开启时间预设：key 是测试钩子 openat-preset 的 data-value（spec/ui/testids.md） */
export const PRESET_AT: Record<string, () => number> = {
  "1m": () => Date.now() + 125 * 1000,
  tm: shift((d) => d.setDate(d.getDate() + 1)),
  "1w": shift((d) => d.setDate(d.getDate() + 7)),
  "1mo": shift((d) => d.setMonth(d.getMonth() + 1)),
  "1y": shift((d) => d.setFullYear(d.getFullYear() + 1)),
  "5y": shift((d) => d.setFullYear(d.getFullYear() + 5)),
  "10y": shift((d) => {
    d.setFullYear(d.getFullYear() + 10);
    d.setDate(d.getDate() - 1);
  }),
};

// ---------------------------------------------------------------- 草稿

export interface Draft {
  title: string;
  content: string;
  openAt: number;
  openAtMissing: boolean;
  preset: string | null;
  inPlaza: boolean;
}

const freshDraft = (): Draft => ({ title: "", content: "", openAt: PRESET_AT["1y"](), openAtMissing: false, preset: "1y", inPlaza: true });

const [draft, setDraft] = createStore<Draft>(freshDraft());
/** 每次改动草稿加一：封存成功时只有版本没变（等待期间没人再改过）才清空 */
let draftVersion = 0;

function patchDraft(p: Partial<Draft>) {
  draftVersion++;
  setDraft(p);
}
function resetDraft() {
  draftVersion++;
  setDraft(freshDraft());
}

// 草稿属于写它的人：登出、登录态失效、换了另一个账号时一律清空，
// 免得同一标签页里下一位用户读到（甚至以自己的身份封存）上一位的草稿
onAccountChange(resetDraft);

// ---------------------------------------------------------------- 主逻辑

type Field = "title" | "content" | "openAt";

export function createCapsuleForm() {
  const [errors, setErrors] = createStore<Partial<Record<Field, string>>>({});
  const [shake, setShake] = createStore<Record<Field, number>>({ title: 0, content: 0, openAt: 0 });
  let submitPending = false;
  const [submitting, setSubmitting] = createSignal(false);
  const [created, setCreated] = createSignal<CapsuleDetail | null>(null);

  // AI
  const [recos, setRecos] = createSignal<CapsuleRecommendation[]>([]);
  const [recoBusy, setRecoBusy] = createSignal(false);
  const [aiBusy, setAiBusy] = createSignal(false);
  const [aiThinking, setAiThinking] = createSignal(false);
  const [aiDone, setAiDone] = createSignal(false);
  const [aiNote, setAiNote] = createSignal("");
  let recoSeq = 0;
  let typeToken = 0;

  // 开启时间：草稿里的时刻可能已经过期（离开太久），进来时顺延到合法范围
  if (!draft.openAtMissing && draft.openAt < LIMITS.minOpen()) patchDraft({ openAt: PRESET_AT["1y"](), preset: "1y" });
  // 离开页面（或换账号）时停止打字
  onCleanup(() => typeToken++);

  async function loadRecos() {
    const my = ++recoSeq;
    setRecoBusy(true);
    try {
      const r = await api.capsuleRecommendations({ count: 4 });
      if (my !== recoSeq) return;
      // LLM 不可用时返回空数组：静默，不覆盖已有推荐
      if (r.items.length) setRecos(r.items);
    } catch {
      /* 推荐失败也静默 */
    } finally {
      if (my === recoSeq) setRecoBusy(false);
    }
  }
  void loadRecos();

  const fail = (f: Field, msg: string) => {
    batch(() => {
      setErrors(f, msg);
      setShake(f, (n) => n + 1);
    });
  };
  const clearErr = (f?: Field) => (f ? setErrors(f, undefined) : setErrors({ title: undefined, content: undefined, openAt: undefined }));

  function stopTyping() {
    typeToken++;
    setAiBusy(false);
    setAiThinking(false);
  }

  /** 手动编辑：正在代笔（等待响应或逐字填入）时立即终止这次代笔对草稿的写入 */
  function edit(f: Field | null, p: Partial<Draft>) {
    if (aiBusy()) stopTyping();
    if (f) clearErr(f);
    patchDraft(p);
  }

  /** 打字机：逐字写进去，标点处稍停；被打断（token 变了）就返回 false */
  async function typeInto(which: "title" | "content", text: string, token: number) {
    if (reducedMotion()) {
      patchDraft({ [which]: text });
      return true;
    }
    const step = which === "title" ? 1 : 3;
    for (let i = 0; i <= text.length; i += step) {
      if (token !== typeToken) return false;
      patchDraft({ [which]: text.slice(0, i) });
      await sleep(/[，。？！、—…：\n]/.test(text[i - 1] ?? "") ? 50 : 14);
    }
    if (token !== typeToken) return false;
    patchDraft({ [which]: text });
    return true;
  }

  /** AI 代笔：标题留空时连标题一起生成；forcedTitle 来自点选的推荐主题 */
  async function aiWrite(forcedTitle?: string) {
    if (aiBusy()) return;
    const token = ++typeToken;
    const typed = (forcedTitle ?? draft.title).trim();
    const auto = !typed;
    setAiBusy(true);
    setAiThinking(true);
    setAiNote("");
    clearErr();
    if (forcedTitle != null) patchDraft({ title: forcedTitle });
    // 请求成功之前不动用户已写的正文：失败时原文还在；等待期间用户改了正文（edit 会让 token 失效），结果就不再覆盖
    try {
      const s = await api.suggestCapsule({ title: typed || undefined });
      if (token !== typeToken) return;
      setAiThinking(false);
      const title = s.title ?? typed;
      if (auto && !(await typeInto("title", title, token))) return;
      patchDraft({ content: "" });
      const openAt = Math.min(Math.max(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30000), LIMITS.maxOpen());
      patchDraft(Number.isFinite(openAt) ? { openAt, openAtMissing: false, preset: null } : { openAtMissing: true, preset: null });
      if (!(await typeInto("content", s.content, token))) return;
      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      setAiNote(`${auto ? "标题与正文均由 AI 代笔" : "已为你代笔"}，建议 ${fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`);
      setAiDone(true);
    } catch (e) {
      if (token === typeToken) toast(e instanceof ApiError ? e.message : "AI 暂时没有回应，请稍后再试", { tone: "error" });
    } finally {
      if (token === typeToken) {
        setAiBusy(false);
        setAiThinking(false);
      }
    }
  }

  /** 校验通过返回 true；不通过时标出字段并抖一下 */
  function validate(): boolean {
    if (aiBusy()) stopTyping();
    if (!draft.title.trim()) return fail("title", MSG.title), false;
    if (!draft.content.trim()) return fail("content", MSG.content), false;
    if (draft.openAtMissing) return fail("openAt", MSG.openMissing), false;
    if (draft.openAt < LIMITS.minOpen()) return fail("openAt", MSG.openMin), false;
    if (draft.openAt > LIMITS.maxOpen()) return fail("openAt", MSG.openMax), false;
    return true;
  }

  async function submit(): Promise<CapsuleDetail | null> {
    if (submitPending || !validate()) return null;
    submitPending = true;
    setSubmitting(true);
    const version = draftVersion;
    const s = { ...unwrap(draft) };
    try {
      const c = await api.createCapsule({
        title: s.title.trim(),
        content: s.content,
        openAt: new Date(s.openAt).toISOString(),
        inPlaza: s.inPlaza,
      });
      setCreated(c);
      // 只清空本次提交的那一版：等待期间又改过的草稿留着
      if (draftVersion === version) resetDraft();
      return c;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "封存失败，请稍后再试", { tone: "error" });
      return null;
    } finally {
      submitPending = false;
      setSubmitting(false);
    }
  }

  function again() {
    batch(() => {
      setCreated(null);
      setAiDone(false);
      setAiNote("");
      clearErr();
    });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  return {
    /** 草稿（只读 store）：f.draft.title、f.draft.openAt… */
    draft,
    errors,
    shake,
    submitting,
    created,
    recos,
    recoBusy,
    showRecos: createMemo(() => !draft.title.trim() && recos().length > 0),
    aiBusy,
    aiThinking,
    aiDone,
    aiNote,
    setTitle: (title: string) => edit("title", { title }),
    setContent: (content: string) => edit("content", { content }),
    setOpenAt: (openAt: number) =>
      edit("openAt", Number.isFinite(openAt) ? { openAt, openAtMissing: false, preset: null } : { openAtMissing: true, preset: null }),
    pickPreset: (key: string) => edit("openAt", { openAt: PRESET_AT[key](), openAtMissing: false, preset: key }),
    setInPlaza: (inPlaza: boolean) => patchDraft({ inPlaza }),
    refreshRecos: loadRecos,
    aiWrite,
    stopTyping,
    validate,
    submit,
    again,
  };
}

export type CapsuleForm = ReturnType<typeof createCapsuleForm>;
