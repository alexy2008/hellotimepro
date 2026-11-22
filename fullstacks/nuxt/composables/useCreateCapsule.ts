// ============================================================
// 创建页的共享逻辑（两套皮肤共用）
// - 草稿：在 stores/draft（内存），切换皮肤、离开再回来都接着写；封存成功、登出、换账号时清空
// - 字段用可写 computed 暴露，视图里直接 v-model；写入时顺手清掉该字段的错误
// - 校验：文案以 spec/ui/copy.md 为准
// - AI：推荐主题（序号守卫防乱序、空列表不覆盖已有推荐）、代笔（打字机效果，可被打断）
// - 封存：调接口，返回胶囊给皮肤展示回执
// 路由提供 reactive 表单，皮肤通过 useCreateForm() 注入同一份状态。
// ============================================================

import { computed, inject, onScopeDispose, provide, reactive, ref, shallowRef, type InjectionKey } from "vue";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail, type CapsuleRecommendation } from "@/types";
import { fmt, reducedMotion, sleep } from "@/lib/fmt";
import { LIMITS, MSG, PRESET_AT } from "@/lib/schedule";
import { toast } from "@/stores/feedback";
import { useAuthStore } from "@/stores/auth";
import { useDraftStore } from "@/stores/draft";

type Field = "title" | "content" | "openAt";

export function useCreateCapsule() {
  const auth = useAuthStore();
  const draft = useDraftStore();
  const errors = reactive<Partial<Record<Field, string>>>({});
  /** 每次校验失败给对应字段加一，视图据此「抖一下」 */
  const shake = reactive<Record<Field, number>>({ title: 0, content: 0, openAt: 0 });
  const submitting = ref(false);
  const created = shallowRef<CapsuleDetail | null>(null);

  // AI
  const recos = ref<CapsuleRecommendation[]>([]);
  const recoBusy = ref(false);
  const aiBusy = ref(false);
  const aiThinking = ref(false);
  const aiDone = ref(false);
  const aiNote = ref("");
  let recoSeq = 0;
  let typeToken = 0;

  // 开启时间：草稿里的时刻可能已经过期（离开太久），进来时顺延到合法范围
  if (draft.openAt < LIMITS.minOpen()) {
    draft.openAt = PRESET_AT["1y"]();
    draft.preset = "1y";
  }
  onScopeDispose(() => typeToken++); // 离开创建路由时停止打字

  const fail = (f: Field, msg: string) => {
    errors[f] = msg;
    shake[f]++;
  };
  const clearErr = (f?: Field) => {
    for (const k of f ? [f] : (Object.keys(errors) as Field[])) errors[k] = undefined;
  };

  // ---------------------------------------------------------------- 字段（v-model）

  const title = computed({
    get: () => draft.title,
    set: (v: string) => {
      if (aiBusy.value) stopTyping();
      clearErr("title");
      draft.title = v;
    },
  });
  const content = computed({
    get: () => draft.content,
    set: (v: string) => {
      if (aiBusy.value) stopTyping(); // 用户自己动手改了：AI 让位
      clearErr("content");
      draft.content = v;
    },
  });
  const inPlaza = computed({
    get: () => draft.inPlaza,
    set: (v: boolean) => (draft.inPlaza = v),
  });

  function setOpenAt(t: number, preset: string | null = null) {
    if (aiBusy.value) stopTyping();
    clearErr("openAt");
    draft.openAt = t;
    draft.preset = preset;
  }
  const pickPreset = (key: string) => setOpenAt(PRESET_AT[key](), key);

  // ---------------------------------------------------------------- AI

  async function loadRecos() {
    const my = ++recoSeq;
    recoBusy.value = true;
    try {
      const r = await api.capsuleRecommendations({ count: 4 });
      if (my !== recoSeq) return;
      // LLM 不可用时返回空数组：静默，不覆盖已有推荐
      if (r.items.length) recos.value = r.items;
    } catch {
      /* 推荐失败也静默 */
    } finally {
      if (my === recoSeq) recoBusy.value = false;
    }
  }
  void loadRecos();

  function stopTyping() {
    typeToken++;
    aiBusy.value = false;
    aiThinking.value = false;
  }

  /** 打字机：逐字写进去，标点处稍停；被打断（token 变了）就返回 false */
  async function typeInto(which: "title" | "content", text: string, token: number) {
    if (reducedMotion()) {
      draft[which] = text;
      return true;
    }
    const step = which === "title" ? 1 : 3;
    for (let i = 0; i <= text.length; i += step) {
      if (token !== typeToken) return false;
      draft[which] = text.slice(0, i);
      await sleep(/[，。？！、—…：\n]/.test(text[i - 1] ?? "") ? 50 : 14);
    }
    if (token !== typeToken) return false;
    draft[which] = text;
    return true;
  }

  /** AI 代笔：标题留空时连标题一起生成；forcedTitle 来自点选的推荐主题 */
  async function aiWrite(forcedTitle?: string) {
    if (aiBusy.value) return;
    const token = ++typeToken;
    const typed = (forcedTitle ?? draft.title).trim();
    const auto = !typed;
    aiBusy.value = true;
    aiThinking.value = true;
    aiNote.value = "";
    clearErr();
    if (forcedTitle != null) draft.title = forcedTitle;
    // 请求成功之前不动用户已写的正文：失败时原文还在；
    // 等待期间用户改了正文（content 的 setter 会让 token 失效），结果就不再覆盖
    try {
      const s = await api.suggestCapsule({ title: typed || undefined });
      if (token !== typeToken) return;
      aiThinking.value = false;
      const t = s.title ?? typed;
      if (auto && !(await typeInto("title", t, token))) return;
      draft.content = "";
      draft.openAt = Math.min(Math.max(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30_000), LIMITS.maxOpen());
      draft.preset = null;
      if (!(await typeInto("content", s.content, token))) return;
      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      aiNote.value = `${auto ? "标题与正文均由 AI 代笔" : "已为你代笔"}，建议 ${fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`;
      aiDone.value = true;
    } catch (e) {
      if (token === typeToken) toast(e instanceof ApiError ? e.message : "AI 暂时没有回应，请稍后再试", { tone: "error" });
    } finally {
      if (token === typeToken) {
        aiBusy.value = false;
        aiThinking.value = false;
      }
    }
  }

  // ---------------------------------------------------------------- 校验与封存

  /** 校验通过返回 true；不通过时标出字段并抖一下 */
  function validate(): boolean {
    if (aiBusy.value) stopTyping();
    if (!draft.title.trim()) return fail("title", MSG.title), false;
    if (!draft.content.trim()) return fail("content", MSG.content), false;
    if (draft.openAt < LIMITS.minOpen()) return fail("openAt", MSG.openMin), false;
    if (draft.openAt > LIMITS.maxOpen()) return fail("openAt", MSG.openMax), false;
    return true;
  }

  async function submit(): Promise<CapsuleDetail | null> {
    if (submitting.value || !validate()) return null;
    submitting.value = true;
    const owner = auth.user?.id;
    const revision = draft.revision;
    try {
      const c = await api.createCapsule({
        title: draft.title.trim(),
        content: draft.content,
        openAt: new Date(draft.openAt).toISOString(),
        inPlaza: draft.inPlaza,
      });
      if (auth.user?.id !== owner) return null;
      created.value = c;
      if (draft.revision === revision) draft.reset();
      return c;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "封存失败，请稍后再试", { tone: "error" });
      return null;
    } finally {
      submitting.value = false;
    }
  }

  function again() {
    created.value = null;
    aiDone.value = false;
    aiNote.value = "";
    clearErr();
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  return {
    draft,
    title,
    content,
    inPlaza,
    errors,
    shake,
    submitting,
    created,
    recos,
    recoBusy,
    showRecos: computed(() => !draft.title.trim() && recos.value.length > 0),
    aiBusy,
    aiThinking,
    aiDone,
    aiNote,
    setOpenAt,
    pickPreset,
    refreshRecos: loadRecos,
    aiWrite,
    stopTyping,
    validate,
    submit,
    again,
  };
}

const createFormKey: InjectionKey<ReturnType<typeof createForm>> = Symbol("createForm");
const createForm = () => reactive(useCreateCapsule());

export function provideCreateForm() {
  provide(createFormKey, createForm());
}

export function useCreateForm() {
  const form = inject(createFormKey);
  if (!form) throw new Error("创建表单需要使用创建路由的状态");
  return form;
}
