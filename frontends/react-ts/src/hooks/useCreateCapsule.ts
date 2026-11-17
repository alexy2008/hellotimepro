// ============================================================
// 创建页的共享逻辑（两套皮肤共用）
// - 草稿：标题 / 正文 / 开启时刻 / 是否公开，放在内存 store 里，
//   切换皮肤、离开再回来都接着写；封存成功后清空
// - 校验：文案以 spec/ui/copy.md 为准
// - AI：推荐主题（序号守卫防乱序、空列表不覆盖已有推荐）、代笔（打字机效果，可被打断）
// - 封存：调接口，返回胶囊给皮肤展示回执
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail, type CapsuleRecommendation } from "@/types";
import { fmt, reducedMotion, sleep } from "@/lib/fmt";
import { toast } from "@/stores/feedback";

export const DAY = 86400000;

/** 开启时间上下限：晚于此刻 + 61 秒，不超过 10 年（契约是 +60 秒与 10 年，留一点余量） */
export const LIMITS = {
  minOpen: () => Date.now() + 61 * 1000,
  maxOpen: () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    return d.getTime() - 5 * 60 * 1000;
  },
};

export const MSG = {
  title: "先给这枚胶囊起个标题",
  content: "还没写内容呢，写点什么吧",
  openMin: "开启时间至少要在 1 分钟之后",
  openMax: "开启时间不能超过 10 年",
};

const atNine = (d: Date) => {
  d.setHours(9, 0, 0, 0);
  return d.getTime();
};

export interface Preset {
  key: string;
  label: string;
  sub?: string;
  at: () => number;
}

/** 开启时间预设：key 是测试钩子 openat-preset 的 data-value（spec/ui/testids.md） */
export const PRESET_AT: Record<string, () => number> = {
  "1m": () => Date.now() + 125 * 1000,
  tm: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return atNine(d);
  },
  "1w": () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return atNine(d);
  },
  "1mo": () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return atNine(d);
  },
  "1y": () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return atNine(d);
  },
  "5y": () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return atNine(d);
  },
  "10y": () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    d.setDate(d.getDate() - 1);
    return atNine(d);
  },
};

// ---------------------------------------------------------------- 草稿

interface Draft {
  title: string;
  content: string;
  openAt: number;
  preset: string | null;
  inPlaza: boolean;
}

const freshDraft = (): Draft => ({ title: "", content: "", openAt: PRESET_AT["1y"](), preset: "1y", inPlaza: true });

export const useDraft = create<Draft & { patch: (p: Partial<Draft>) => void; reset: () => void }>()((set) => ({
  ...freshDraft(),
  patch: (p) => set(p),
  reset: () => set(freshDraft()),
}));

// ---------------------------------------------------------------- 主逻辑

type Field = "title" | "content" | "openAt";

export function useCreateCapsule() {
  const d = useDraft();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [shake, setShake] = useState<Record<Field, number>>({ title: 0, content: 0, openAt: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CapsuleDetail | null>(null);

  // AI
  const [recos, setRecos] = useState<CapsuleRecommendation[]>([]);
  const [recoBusy, setRecoBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const recoSeq = useRef(0);
  const typeToken = useRef(0);

  // 开启时间：草稿里的时刻可能已经过期（离开太久），进来时顺延到合法范围
  useEffect(() => {
    const s = useDraft.getState();
    if (s.openAt < LIMITS.minOpen()) s.patch({ openAt: PRESET_AT["1y"](), preset: "1y" });
    return () => {
      typeToken.current++; // 离开页面时停止打字
    };
  }, []);

  const loadRecos = useCallback(async () => {
    const my = ++recoSeq.current;
    setRecoBusy(true);
    try {
      const r = await api.capsuleRecommendations({ count: 4 });
      if (my !== recoSeq.current) return;
      // LLM 不可用时返回空数组：静默，不覆盖已有推荐
      if (r.items.length) setRecos(r.items);
    } catch {
      /* 推荐失败也静默 */
    } finally {
      if (my === recoSeq.current) setRecoBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadRecos();
  }, [loadRecos]);

  const fail = (f: Field, msg: string) => {
    setErrors((e) => ({ ...e, [f]: msg }));
    setShake((s) => ({ ...s, [f]: s[f] + 1 }));
  };
  const clearErr = (f?: Field) => setErrors((e) => (f ? { ...e, [f]: undefined } : {}));

  const setTitle = (title: string) => {
    clearErr("title");
    d.patch({ title });
  };
  const setContent = (content: string) => {
    if (aiBusy) stopTyping();
    clearErr("content");
    d.patch({ content });
  };
  const setOpenAt = (openAt: number, preset: string | null = null) => {
    clearErr("openAt");
    d.patch({ openAt, preset });
  };
  const pickPreset = (key: string) => setOpenAt(PRESET_AT[key](), key);
  const setInPlaza = (inPlaza: boolean) => d.patch({ inPlaza });

  function stopTyping() {
    typeToken.current++;
    setAiBusy(false);
    setAiThinking(false);
  }

  /** 打字机：逐字写进去，标点处稍停；被打断（token 变了）就返回 false */
  async function typeInto(which: "title" | "content", text: string, token: number) {
    if (reducedMotion()) {
      useDraft.getState().patch({ [which]: text });
      return true;
    }
    const step = which === "title" ? 1 : 3;
    for (let i = 0; i <= text.length; i += step) {
      if (token !== typeToken.current) return false;
      useDraft.getState().patch({ [which]: text.slice(0, i) });
      await sleep(/[，。？！、—…：\n]/.test(text[i - 1] ?? "") ? 50 : 14);
    }
    if (token !== typeToken.current) return false;
    useDraft.getState().patch({ [which]: text });
    return true;
  }

  /** AI 代笔：标题留空时连标题一起生成；forcedTitle 来自点选的推荐主题 */
  async function aiWrite(forcedTitle?: string) {
    if (aiBusy) return;
    const token = ++typeToken.current;
    const typed = (forcedTitle ?? useDraft.getState().title).trim();
    const auto = !typed;
    setAiBusy(true);
    setAiThinking(true);
    setAiNote("");
    clearErr();
    if (forcedTitle != null) d.patch({ title: forcedTitle });
    d.patch({ content: "" });
    try {
      const s = await api.suggestCapsule({ title: typed || undefined });
      if (token !== typeToken.current) return;
      setAiThinking(false);
      const title = s.title ?? typed;
      if (auto && !(await typeInto("title", title, token))) return;
      const openAt = Math.min(Math.max(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30000), LIMITS.maxOpen());
      useDraft.getState().patch({ openAt, preset: null });
      if (!(await typeInto("content", s.content, token))) return;
      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      setAiNote(`${auto ? "标题与正文均由 AI 代笔" : "已为你代笔"}，建议 ${fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`);
      setAiDone(true);
    } catch (e) {
      if (token === typeToken.current) toast(e instanceof ApiError ? e.message : "AI 暂时没有回应，请稍后再试", { tone: "error" });
    } finally {
      if (token === typeToken.current) {
        setAiBusy(false);
        setAiThinking(false);
      }
    }
  }

  /** 校验通过返回 true；不通过时标出字段并抖一下 */
  function validate(): boolean {
    if (aiBusy) stopTyping();
    const s = useDraft.getState();
    if (!s.title.trim()) return fail("title", MSG.title), false;
    if (!s.content.trim()) return fail("content", MSG.content), false;
    if (s.openAt < LIMITS.minOpen()) return fail("openAt", MSG.openMin), false;
    if (s.openAt > LIMITS.maxOpen()) return fail("openAt", MSG.openMax), false;
    return true;
  }

  async function submit(): Promise<CapsuleDetail | null> {
    if (submitting || !validate()) return null;
    setSubmitting(true);
    const s = useDraft.getState();
    try {
      const c = await api.createCapsule({
        title: s.title.trim(),
        content: s.content,
        openAt: new Date(s.openAt).toISOString(),
        inPlaza: s.inPlaza,
      });
      setCreated(c);
      useDraft.getState().reset();
      return c;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "封存失败，请稍后再试", { tone: "error" });
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  function again() {
    setCreated(null);
    setAiDone(false);
    setAiNote("");
    clearErr();
    useDraft.getState().reset();
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  return {
    ...d,
    errors,
    shake,
    submitting,
    created,
    recos,
    recoBusy,
    showRecos: !d.title.trim() && recos.length > 0,
    aiBusy,
    aiThinking,
    aiDone,
    aiNote,
    setTitle,
    setContent,
    setOpenAt,
    pickPreset,
    setInPlaza,
    refreshRecos: loadRecos,
    aiWrite,
    stopTyping,
    validate,
    submit,
    again,
  };
}
