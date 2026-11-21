// ============================================================
// 账号相关的共享逻辑（两套皮肤共用）：登录、注册、「我的」三个页签、资料与密码
// - 表单内容在 stores/forms（内存）：切换皮肤时视图整个换掉，值不丢（X5）
// - 离开该页面时清空：用 Vue Router 的组件内守卫判断「真的离开」——
//   切换皮肤不会触发路由守卫，换页才会
// ============================================================

import { computed, h, onScopeDispose, reactive, ref, shallowRef, watch, type FunctionalComponent } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter, type RouteLocationNormalized } from "vue-router";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { useFormsStore, type FormKey } from "@/stores/forms";
import { confirmDialog, toast } from "@/stores/feedback";
import { safeRedirect } from "@/lib/redirect";
import { AVATARS } from "@/lib/avatars";
import { ApiError, type CapsuleListItem, type MyStats } from "@/types";

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const NICK_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
export const NICK_MSG = "昵称需为 2–20 个字符：字母、数字、下划线或连字符";
export const pwdRules = (v: string) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
export const pwdValid = (v: string) => {
  const r = pwdRules(v);
  return r.len && r.alpha && r.digit;
};

export type NickStateValue = "" | "valid" | "invalid" | "taken";

/** 昵称的即时检查：没有专门的唯一性接口，这里只做格式；重名在提交时由后端告诉我们 */
export function nickState(v: string, errors?: Errors): { state: "" | "valid" | "invalid" | "taken"; hint?: string } {
  if (errors?.nickname) return { state: errors.nicknameState === "taken" ? "taken" : "invalid", hint: errors.nickname };
  const t = v.trim();
  if (!t) return { state: "" };
  if (Array.from(t).length < 2) return { state: "", hint: "至少 2 个字符" };
  if (!NICK_RE.test(t)) return { state: "invalid", hint: "只能用字母、数字、下划线和连字符" };
  return { state: "valid" };
}

/** 登录 / 注册之间互相跳转时把 ?redirect= 带过去 */
export const withRedirect = (path: string, redirect: string | null) =>
  redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;

/** URL 上的 ?redirect= */
export function useRedirectParam() {
  const route = useRoute();
  return computed(() => {
    const r = route.query.redirect;
    return typeof r === "string" && r ? r : null;
  });
}

/** 头像列表：id 以后端 /avatars 为准（测试要求从后端加载），画法用本地内联的 v2 徽记 */
export function useAvatarIds() {
  const ids = ref<string[]>([]);
  let alive = true;
  api
    .avatars()
    .then((list) => alive && (ids.value = list.map((a) => a.id)))
    .catch(() => alive && (ids.value = AVATARS.map((a) => a.id)));
  onScopeDispose(() => (alive = false));
  return ids;
}

type Errors = Record<string, string | undefined>;

/** 后端的字段错误（422 details / 409 field）映射到表单字段 */
function fieldErrors(e: unknown, nicknameChanged = false): Errors {
  if (!(e instanceof ApiError)) return { form: "网络异常，请稍后再试" };
  const out: Errors = {};
  for (const d of e.details ?? []) out[d.field] = d.message;
  if (out["nickname"] && e.status === 409) out["nicknameState"] = "taken";
  if (!Object.keys(out).length) out.form = e.message;
  if (nicknameChanged) {
    delete out.nickname;
    delete out.nicknameState;
  }
  return out;
}

function setErrors(target: Errors, next: Errors) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, next);
}

/**
 * 离开页面时清空表单。stays(to) 返回 true 表示「还在这一页」（只是查询串或同页参数变了）。
 * 切换皮肤会卸载视图组件，但不经过路由守卫，所以不会误清
 */
function useClearOnLeave(keys: FormKey[], stays: (to: RouteLocationNormalized) => boolean) {
  const forms = useFormsStore();
  onBeforeRouteLeave(() => forms.clear(...keys));
  onBeforeRouteUpdate((to) => {
    if (!stays(to)) forms.clear(...keys);
  });
}

// ---------------------------------------------------------------- 登录

export function useLogin() {
  const auth = useAuthStore();
  const forms = useFormsStore();
  const router = useRouter();
  const redirect = useRedirectParam();
  const errors = reactive<Errors>({});
  const busy = ref(false);
  useClearOnLeave(["login"], (to) => to.path === "/login");

  async function submit() {
    const { email, password } = forms.login;
    const errs: Errors = {};
    if (!emailOk(email)) errs.email = "请输入有效的邮箱地址";
    else if (!password) errs.password = "请输入密码";
    setErrors(errors, errs);
    if (Object.keys(errs).length) return;
    busy.value = true;
    try {
      const t = await api.login({ email: email.trim(), password });
      auth.setTokens(t);
      forms.clear("login");
      toast(`欢迎回来，${t.user.nickname}`);
      await router.replace(redirect.value ? safeRedirect(redirect.value, "/") : "/me/created");
    } catch (e) {
      // 不区分「邮箱不存在」与「密码错误」
      setErrors(errors, {
        form: e instanceof ApiError && e.status === 401 ? "邮箱或密码不正确" : e instanceof ApiError ? e.message : "网络异常，请稍后再试",
      });
    } finally {
      busy.value = false;
    }
  }

  /** 重新输入时收起整表错误 */
  const onInput = () => errors.form && setErrors(errors, {});

  return { form: forms.login, errors, busy, submit, onInput, redirect };
}

// ---------------------------------------------------------------- 注册

export function useRegister() {
  const auth = useAuthStore();
  const forms = useFormsStore();
  const router = useRouter();
  const redirect = useRedirectParam();
  const errors = reactive<Errors>({});
  const busy = ref(false);
  watch(() => forms.register.nickname, () => { delete errors.nickname; delete errors.nicknameState; });
  useClearOnLeave(["register"], (to) => to.path === "/register");

  async function submit() {
    const v = { ...forms.register };
    const errs: Errors = {};
    if (!emailOk(v.email)) errs.email = "请输入有效的邮箱地址";
    else if (!NICK_RE.test(v.nickname.trim())) errs.nickname = NICK_MSG;
    else if (!pwdValid(v.password)) errs.password = "密码至少 8 位，且同时包含字母和数字";
    setErrors(errors, errs);
    if (Object.keys(errs).length) return;
    busy.value = true;
    try {
      const t = await api.register({ email: v.email.trim(), nickname: v.nickname.trim(), password: v.password, avatarId: v.avatarId });
      auth.setTokens(t);
      forms.clear("register");
      toast(`你好，${t.user.nickname}`);
      await router.replace(redirect.value ? safeRedirect(redirect.value, "/") : "/create");
    } catch (e) {
      setErrors(errors, fieldErrors(e, v.nickname !== forms.register.nickname));
    } finally {
      busy.value = false;
    }
  }

  return {
    form: forms.register,
    nick: computed(() => nickState(forms.register.nickname, errors)),
    errors,
    busy,
    submit,
    redirect,
  };
}

// ---------------------------------------------------------------- 「我的」

/** 页头统计：/me/stats；列表有增删时调用 refresh */
export function useMyStats() {
  const stats = ref<MyStats | null>(null);
  const refresh = () => {
    api
      .myStats()
      .then((s) => (stats.value = s))
      .catch(() => undefined);
  };
  refresh();
  return { stats, refresh };
}

const PAGE_SIZE = 20;

/** 我创建的 / 我收藏的：一页 20 枚，「加载更多」往后接（列表一直按时间倒序） */
export function useMyList(kind: "created" | "favorites", onChange?: () => void) {
  const items = ref<CapsuleListItem[] | null>(null);
  const total = ref(0);
  const error = ref(false);
  const moreBusy = ref(false);
  let seq = 0;
  onScopeDispose(() => seq++);

  const fetchPage = (n: number) => (kind === "created" ? api.myCapsules(n, PAGE_SIZE) : api.myFavorites(n, PAGE_SIZE));

  async function load() {
    const my = ++seq;
    try {
      const r = await fetchPage(1);
      if (my !== seq) return;
      items.value = r.items;
      total.value = r.pagination.total;
      error.value = false;
    } catch {
      if (my === seq) error.value = true;
    }
  }
  void load();

  /** 从已显示的条数推算下一条所在的页；删除后重读边界页，补上前移的记录。 */
  async function loadMore() {
    if (moreBusy.value) return;
    const my = seq;
    moreBusy.value = true;
    try {
      const r = await fetchPage(Math.floor((items.value?.length ?? 0) / PAGE_SIZE) + 1);
      if (my !== seq) return;
      const have = new Set((items.value ?? []).map((i) => i.id));
      items.value = [...(items.value ?? []), ...r.items.filter((i) => !have.has(i.id))];
      total.value = r.pagination.total;
    } catch {
      if (my === seq) toast("加载失败，请稍后再试", { tone: "error" });
    } finally {
      if (my === seq) moreBusy.value = false;
    }
  }

  const drop = (id: string) => {
    seq++;
    moreBusy.value = false;
    items.value = (items.value ?? []).filter((i) => i.id !== id);
    total.value = Math.max(0, total.value - 1);
    if (!items.value?.length && total.value > 0) void load();
  };

  /** 删除：确认框写明后果（spec/ui/copy.md §3）；mark 是各皮肤的小插画 */
  async function remove(c: CapsuleListItem, mark?: FunctionalComponent) {
    const ok = await confirmDialog({
      title: "删除这枚胶囊？",
      body: () => [
        h("p", [
          `《${c.title}》会被永久删除。持有胶囊码 `,
          h("b", { class: "mono" }, c.code),
          " 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。",
        ]),
        h("p", { class: "dlg__warn" }, "此操作不可恢复。"),
      ],
      confirm: "删除",
      cancel: "再想想",
      tone: "danger",
      mark,
    });
    if (!ok) return false;
    try {
      await api.deleteMyCapsule(c.id);
      drop(c.id);
      toast(`已删除《${c.title}》`);
      onChange?.();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "删除失败，请稍后再试", { tone: "error" });
      return false;
    }
  }

  /** 在「我收藏的」里取消收藏：从列表里拿掉 */
  function onFavChange(id: string, favorited: boolean) {
    if (kind === "favorites" && !favorited) drop(id);
    onChange?.();
  }

  const hasMore = computed(() => !!items.value && items.value.length < total.value);
  return { items, total, hasMore, moreBusy, loadMore, error, reload: load, remove, onFavChange };
}

// ---------------------------------------------------------------- 资料与密码

export type FormMsg = { type: "ok" | "err" | "info"; text: string } | null;

export function useProfile() {
  const auth = useAuthStore();
  const forms = useFormsStore();
  const router = useRouter();
  const user = computed(() => auth.user!);
  const prof = forms.profile;
  useClearOnLeave(["profile", "pwd"], (to) => to.params.tab === "profile");

  // 资料表单：第一次进来（或换了账号）时从当前用户填好；之后切皮肤也接着用 store 里正在改的值
  const fillFromUser = () => {
    const u = auth.user;
    if (u) Object.assign(prof, { userId: u.id, nickname: u.nickname, avatarId: u.avatarId });
  };
  watch(
    () => auth.user?.id,
    (id) => {
      if (id && prof.userId !== id) fillFromUser();
    },
    { immediate: true },
  );

  const errors = reactive<Errors>({});
  const busy = ref(false);
  const msg = shallowRef<FormMsg>(null);
  const pwdBusy = ref(false);
  const pwdMsg = shallowRef<FormMsg>(null);

  const nickname = computed({
    get: () => prof.nickname,
    set: (v: string) => {
      prof.nickname = v;
      errors.nickname = undefined;
    },
  });
  const avatarId = computed({
    get: () => prof.avatarId,
    set: (v: string) => (prof.avatarId = v),
  });
  const pwdField = (k: "current" | "next" | "confirm") =>
    computed({
      get: () => forms.pwd[k],
      set: (v: string) => {
        forms.pwd[k] = v;
        errors[k] = undefined;
      },
    });
  const pwd = { current: pwdField("current"), next: pwdField("next"), confirm: pwdField("confirm") };

  /** 昵称右侧的状态点：没改动时不显示 */
  const nick = computed<NickStateValue>(() =>
    prof.nickname.trim() === user.value.nickname ? "" : nickState(prof.nickname, errors).state,
  );
  const nickHint = computed(() => nickState(prof.nickname).hint);

  async function saveProfile() {
    msg.value = null;
    setErrors(errors, {});
    const u = user.value;
    const patch: { nickname?: string; avatarId?: string } = {};
    if (prof.nickname.trim() !== u.nickname) patch.nickname = prof.nickname.trim();
    if (prof.avatarId !== u.avatarId) patch.avatarId = prof.avatarId;
    if (!Object.keys(patch).length) {
      toast("没有需要保存的修改", { tone: "info" });
      msg.value = { type: "info", text: "没有改动" };
      return;
    }
    if (patch.nickname != null && !NICK_RE.test(patch.nickname)) {
      errors.nickname = NICK_MSG;
      return;
    }
    busy.value = true;
    try {
      await api.updateProfile(patch);
      await auth.refreshMe();
      msg.value = { type: "ok", text: "已保存" };
      toast("资料已更新");
    } catch (e) {
      const errs = fieldErrors(e, patch.nickname !== prof.nickname.trim());
      setErrors(errors, errs);
      if (errs.form) msg.value = { type: "err", text: errs.form };
    } finally {
      busy.value = false;
    }
  }

  function resetProfile() {
    fillFromUser();
    setErrors(errors, {});
    msg.value = null;
  }

  async function changePassword() {
    pwdMsg.value = null;
    const { current, next, confirm } = forms.pwd;
    const errs: Errors = {};
    if (!current) errs.current = "请输入当前密码";
    else if (!pwdValid(next)) errs.next = "新密码至少 8 位，且同时包含字母和数字";
    else if (next !== confirm) errs.confirm = "两次输入的新密码不一致";
    setErrors(errors, errs);
    if (Object.keys(errs).length) return;
    pwdBusy.value = true;
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      forms.clear("pwd");
      pwdMsg.value = { type: "ok", text: "密码已更新。3 秒后将自动登出，请用新密码重新登录。" };
      setTimeout(() => {
        void auth.logout(false).then(() => router.push("/login"));
      }, 3000);
    } catch (e) {
      pwdBusy.value = false;
      errors.current = e instanceof ApiError ? e.message : "修改失败，请稍后再试";
    }
  }

  return {
    user,
    nickname,
    avatarId,
    nick,
    nickHint,
    errors,
    busy,
    msg,
    saveProfile,
    resetProfile,
    pwd,
    pwdBusy,
    pwdMsg,
    changePassword,
  };
}
