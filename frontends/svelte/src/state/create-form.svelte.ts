// ============================================================
// 创建页的表单（两套皮肤共用）。由创建路由（pages/CreatePage）创建、经 context 交给皮肤视图，
// 路由按 user.id 加了 {#key}，换账号就是换一份表单。
// - 草稿：在 stores/draft（内存），切换皮肤、离开再回来都接着写；封存成功、登出、换账号时清空
// - 字段是 getter / setter：视图里直接 bind:value={f.title}；写入时顺手清掉该字段的错误
// - 提交锁与回执（created）归路由所有：切皮肤不会重复提交，也不会丢回执
// - 校验：文案以 spec/ui/copy.md 为准
// - AI：推荐主题（序号守卫防乱序、空列表不覆盖已有推荐）、代笔（打字机效果，可被打断）
// ============================================================

import { createContext } from "svelte";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail, type CapsuleRecommendation } from "@/types";
import { fmt, reducedMotion, sleep } from "@/lib/fmt";
import { LIMITS, MSG, PRESET_AT } from "@/lib/schedule";
import { toast } from "@/stores/feedback.svelte.ts";
import { authStore } from "@/stores/auth.svelte.ts";
import { draft } from "@/stores/draft.svelte.ts";

type Field = "title" | "content" | "openAt";

export class CreateForm {
  errors = $state<Partial<Record<Field, string>>>({});
  /** 每次校验失败给对应字段加一，视图据此「抖一下」 */
  shake = $state<Record<Field, number>>({ title: 0, content: 0, openAt: 0 });
  submitting = $state(false);
  created = $state.raw<CapsuleDetail | null>(null);

  recos = $state.raw<CapsuleRecommendation[]>([]);
  recoBusy = $state(false);
  aiBusy = $state(false);
  aiThinking = $state(false);
  aiDone = $state(false);
  aiNote = $state("");
  showRecos = $derived(!draft.title.trim() && this.recos.length > 0);

  #recoSeq = 0;
  #typeToken = 0;

  constructor() {
    // 开启时间：草稿里的时刻可能已经过期（离开太久），进来时顺延到合法范围
    if (draft.openAt < LIMITS.minOpen()) draft.patch({ openAt: PRESET_AT["1y"](), preset: "1y" });
    void this.refreshRecos();
    // 离开创建路由时停止打字、作废推荐请求
    $effect(() => () => {
      this.#typeToken++;
      this.#recoSeq++;
    });
  }

  get draft() {
    return draft;
  }

  #fail(f: Field, msg: string) {
    this.errors[f] = msg;
    this.shake[f]++;
  }
  #clearErr(f?: Field) {
    if (f) this.errors[f] = undefined;
    else this.errors = {};
  }

  // ---------------------------------------------------------------- 字段（bind:value）

  get title() {
    return draft.title;
  }
  set title(v: string) {
    if (this.aiBusy) this.stopTyping();
    this.#clearErr("title");
    draft.patch({ title: v });
  }
  get content() {
    return draft.content;
  }
  set content(v: string) {
    if (this.aiBusy) this.stopTyping(); // 用户自己动手改了：AI 让位
    this.#clearErr("content");
    draft.patch({ content: v });
  }
  get inPlaza() {
    return draft.inPlaza;
  }
  set inPlaza(v: boolean) {
    draft.patch({ inPlaza: v });
  }

  setOpenAt = (t: number, preset: string | null = null) => {
    if (this.aiBusy) this.stopTyping();
    this.#clearErr("openAt");
    draft.patch({ openAt: t, preset });
  };
  pickPreset = (key: string) => this.setOpenAt(PRESET_AT[key](), key);

  // ---------------------------------------------------------------- AI

  refreshRecos = async () => {
    const my = ++this.#recoSeq;
    this.recoBusy = true;
    try {
      const r = await api.capsuleRecommendations({ count: 4 });
      if (my !== this.#recoSeq) return;
      // LLM 不可用时返回空数组：静默，不覆盖已有推荐
      if (r.items.length) this.recos = r.items;
    } catch {
      /* 推荐失败也静默 */
    } finally {
      if (my === this.#recoSeq) this.recoBusy = false;
    }
  };

  stopTyping = () => {
    this.#typeToken++;
    this.aiBusy = false;
    this.aiThinking = false;
  };

  /** 打字机：逐字写进去，标点处稍停；被打断（token 变了）就返回 false */
  async #typeInto(which: "title" | "content", text: string, token: number) {
    const put = (v: string) => draft.patch(which === "title" ? { title: v } : { content: v });
    if (reducedMotion()) {
      put(text);
      return true;
    }
    const step = which === "title" ? 1 : 3;
    for (let i = 0; i <= text.length; i += step) {
      if (token !== this.#typeToken) return false;
      put(text.slice(0, i));
      await sleep(/[，。？！、—…：\n]/.test(text[i - 1] ?? "") ? 50 : 14);
    }
    if (token !== this.#typeToken) return false;
    put(text);
    return true;
  }

  /** AI 代笔：标题留空时连标题一起生成；forcedTitle 来自点选的推荐主题 */
  aiWrite = async (forcedTitle?: string) => {
    if (this.aiBusy) return;
    const token = ++this.#typeToken;
    const typed = (forcedTitle ?? draft.title).trim();
    const auto = !typed;
    this.aiBusy = true;
    this.aiThinking = true;
    this.aiNote = "";
    this.#clearErr();
    if (forcedTitle != null) draft.patch({ title: forcedTitle });
    // 请求成功之前不动用户已写的正文：失败时原文还在；
    // 等待期间用户改了正文（content 的 setter 会让 token 失效），结果就不再覆盖
    try {
      const s = await api.suggestCapsule({ title: typed || undefined });
      if (token !== this.#typeToken) return;
      this.aiThinking = false;
      const t = s.title ?? typed;
      if (auto && !(await this.#typeInto("title", t, token))) return;
      draft.patch({
        content: "",
        openAt: Math.min(Math.max(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30_000), LIMITS.maxOpen()),
        preset: null,
      });
      if (!(await this.#typeInto("content", s.content, token))) return;
      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      this.aiNote = `${auto ? "标题与正文均由 AI 代笔" : "已为你代笔"}，建议 ${fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`;
      this.aiDone = true;
    } catch (e) {
      if (token === this.#typeToken) toast(e instanceof ApiError ? e.message : "AI 暂时没有回应，请稍后再试", { tone: "error" });
    } finally {
      if (token === this.#typeToken) {
        this.aiBusy = false;
        this.aiThinking = false;
      }
    }
  };

  // ---------------------------------------------------------------- 校验与封存

  /** 校验通过返回 true；不通过时标出字段并抖一下 */
  validate = (): boolean => {
    if (this.aiBusy) this.stopTyping();
    if (!draft.title.trim()) return this.#fail("title", MSG.title), false;
    if (!draft.content.trim()) return this.#fail("content", MSG.content), false;
    if (draft.openAt < LIMITS.minOpen()) return this.#fail("openAt", MSG.openMin), false;
    if (draft.openAt > LIMITS.maxOpen()) return this.#fail("openAt", MSG.openMax), false;
    return true;
  };

  submit = async (): Promise<CapsuleDetail | null> => {
    if (this.submitting || !this.validate()) return null;
    this.submitting = true;
    const owner = authStore.user?.id;
    const revision = draft.revision;
    try {
      const c = await api.createCapsule({
        title: draft.title.trim(),
        content: draft.content,
        openAt: new Date(draft.openAt).toISOString(),
        inPlaza: draft.inPlaza,
      });
      if (authStore.user?.id !== owner) return null;
      this.created = c;
      // 等待期间又改过草稿：保留新写的内容
      if (draft.revision === revision) draft.reset();
      return c;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "封存失败，请稍后再试", { tone: "error" });
      return null;
    } finally {
      this.submitting = false;
    }
  };

  again = () => {
    this.created = null;
    this.aiDone = false;
    this.aiNote = "";
    this.#clearErr();
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  };
}

const [get, set] = createContext<CreateForm>();
export const provideCreateForm = () => set(new CreateForm());
export const useCreateForm = get;
