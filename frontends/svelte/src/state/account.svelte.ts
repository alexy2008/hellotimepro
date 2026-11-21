// ============================================================
// 账号相关的页面状态（两套皮肤共用）：登录、注册、「我的」统计与列表、资料与密码。
// 表单由路由页面创建、经 context 交给皮肤视图：
// 切换皮肤只换视图，表单实例还在，值不丢（X5）；离开路由时页面销毁，表单随之清空，
// 密码不会在内存里久留。校验规则与文案在 lib/account。
// ============================================================

import { createContext, untrack } from "svelte";
import { navigate } from "svelte-routing";
import { api } from "@/api/client";
import { authStore } from "@/stores/auth.svelte.ts";
import { confirmDialog, toast, type Piece } from "@/stores/feedback.svelte.ts";
import { safeRedirect } from "@/lib/redirect";
import { AVATARS } from "@/lib/avatars";
import { emailOk, NICK_MSG, NICK_RE, nickState, pwdValid, type Errors, type FormMsg } from "@/lib/account";
import { ApiError, type CapsuleListItem, type MyStats } from "@/types";
import DeleteBody from "@/components/DeleteBody.svelte";

export type NickStateValue = "" | "valid" | "invalid" | "taken";

/** 地址栏上的 ?redirect=（登录 / 注册成功后回跳） */
export function redirectParam(): string | null {
  return new URLSearchParams(window.location.search).get("redirect") || null;
}

/** 登录 / 注册之间互相跳转时把 ?redirect= 带过去 */
export const withRedirect = (path: string, redirect: string | null) =>
  redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;

/** 后端的字段错误（422 details / 409 field）映射到表单字段；请求途中昵称又改过，就不再标昵称 */
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

/** 头像列表：id 以后端 /avatars 为准（测试要求从后端加载），画法用本地内联的 v2 徽记 */
export class AvatarIds {
  ids = $state.raw<string[]>([]);
  constructor() {
    let alive = true;
    api
      .avatars()
      .then((list) => alive && (this.ids = list.map((a) => a.id)))
      .catch(() => alive && (this.ids = AVATARS.map((a) => a.id)));
    $effect(() => () => void (alive = false));
  }
}

// ---------------------------------------------------------------- 登录

export class LoginForm {
  email = $state("");
  password = $state("");
  errors = $state<Errors>({});
  busy = $state(false);
  readonly redirect = redirectParam();

  submit = async () => {
    const { email, password } = this;
    const errs: Errors = {};
    if (!emailOk(email)) errs.email = "请输入有效的邮箱地址";
    else if (!password) errs.password = "请输入密码";
    this.errors = errs;
    if (Object.keys(errs).length) return;
    this.busy = true;
    try {
      const t = await api.login({ email: email.trim(), password });
      authStore.setTokens(t);
      this.email = this.password = "";
      toast(`欢迎回来，${t.user.nickname}`);
      navigate(this.redirect ? safeRedirect(this.redirect, "/") : "/me/created", { replace: true });
    } catch (e) {
      // 不区分「邮箱不存在」与「密码错误」
      this.errors = {
        form: e instanceof ApiError && e.status === 401 ? "邮箱或密码不正确" : e instanceof ApiError ? e.message : "网络异常，请稍后再试",
      };
    } finally {
      this.busy = false;
    }
  };

  /** 重新输入时收起整表错误 */
  onInput = () => {
    if (this.errors.form) this.errors = {};
  };
}

// ---------------------------------------------------------------- 注册

export class RegisterForm {
  email = $state("");
  #nickname = $state("");
  password = $state("");
  avatarId = $state("neo");
  errors = $state<Errors>({});
  busy = $state(false);
  nick = $derived(nickState(this.#nickname, this.errors));
  readonly redirect = redirectParam();

  get nickname() {
    return this.#nickname;
  }
  /** 改了昵称：收起昵称上的错误（含「已被占用」） */
  set nickname(v: string) {
    this.#nickname = v;
    if (this.errors.nickname || this.errors.nicknameState) {
      delete this.errors.nickname;
      delete this.errors.nicknameState;
    }
  }

  submit = async () => {
    const v = { email: this.email, nickname: this.#nickname, password: this.password, avatarId: this.avatarId };
    const errs: Errors = {};
    if (!emailOk(v.email)) errs.email = "请输入有效的邮箱地址";
    else if (!NICK_RE.test(v.nickname.trim())) errs.nickname = NICK_MSG;
    else if (!pwdValid(v.password)) errs.password = "密码至少 8 位，且同时包含字母和数字";
    this.errors = errs;
    if (Object.keys(errs).length) return;
    this.busy = true;
    try {
      const t = await api.register({ email: v.email.trim(), nickname: v.nickname.trim(), password: v.password, avatarId: v.avatarId });
      authStore.setTokens(t);
      this.email = this.#nickname = this.password = "";
      toast(`你好，${t.user.nickname}`);
      navigate(this.redirect ? safeRedirect(this.redirect, "/") : "/create", { replace: true });
    } catch (e) {
      this.errors = fieldErrors(e, v.nickname !== this.#nickname);
    } finally {
      this.busy = false;
    }
  };
}

const [getLogin, setLogin] = createContext<LoginForm>();
const [getRegister, setRegister] = createContext<RegisterForm>();
export const provideLogin = () => setLogin(new LoginForm());
export const useLogin = getLogin;
export const provideRegister = () => setRegister(new RegisterForm());
export const useRegister = getRegister;

// ---------------------------------------------------------------- 「我的」

/** 页头统计：/me/stats；列表有增删时调用 refresh */
export class MyStatsState {
  stats = $state.raw<MyStats | null>(null);
  constructor() {
    this.refresh();
  }
  refresh = () => {
    api
      .myStats()
      .then((s) => (this.stats = s))
      .catch(() => undefined);
  };
}

const PAGE_SIZE = 20;

/** 我创建的 / 我收藏的：一页 20 枚，「加载更多」往后接（列表一直按时间倒序） */
export class MyList {
  items = $state.raw<CapsuleListItem[] | null>(null);
  total = $state(0);
  error = $state(false);
  moreBusy = $state(false);
  hasMore = $derived(!!this.items && this.items.length < this.total);
  #seq = 0;

  constructor(
    readonly kind: "created" | "favorites",
    private onChange?: () => void,
  ) {
    void this.reload();
    $effect(() => () => void this.#seq++);
  }

  #fetchPage(n: number) {
    return this.kind === "created" ? api.myCapsules(n, PAGE_SIZE) : api.myFavorites(n, PAGE_SIZE);
  }

  reload = async () => {
    const my = ++this.#seq;
    try {
      const r = await this.#fetchPage(1);
      if (my !== this.#seq) return;
      this.items = r.items;
      this.total = r.pagination.total;
      this.error = false;
    } catch {
      if (my === this.#seq) this.error = true;
    }
  };

  /** 从已显示的条数推算下一条所在的页；删除后重读边界页，补上前移的记录。 */
  loadMore = async () => {
    if (this.moreBusy) return;
    const my = this.#seq;
    this.moreBusy = true;
    try {
      const r = await this.#fetchPage(Math.floor((this.items?.length ?? 0) / PAGE_SIZE) + 1);
      if (my !== this.#seq) return;
      const have = new Set((this.items ?? []).map((i) => i.id));
      this.items = [...(this.items ?? []), ...r.items.filter((i) => !have.has(i.id))];
      this.total = r.pagination.total;
    } catch {
      if (my === this.#seq) toast("加载失败，请稍后再试", { tone: "error" });
    } finally {
      if (my === this.#seq) this.moreBusy = false;
    }
  };

  /** 拿掉一枚：作废进行中的「加载更多」；删空了而后面还有，就从头读 */
  #drop(id: string) {
    this.#seq++;
    this.moreBusy = false;
    this.items = (this.items ?? []).filter((i) => i.id !== id);
    this.total = Math.max(0, this.total - 1);
    if (!this.items.length && this.total > 0) void this.reload();
  }

  /** 删除：确认框写明后果（spec/ui/copy.md §3）；mark 是各皮肤的小插画 */
  remove = async (c: CapsuleListItem, mark?: Piece) => {
    const ok = await confirmDialog({
      title: "删除这枚胶囊？",
      body: { component: DeleteBody, props: { title: c.title, code: c.code } },
      confirm: "删除",
      cancel: "再想想",
      tone: "danger",
      mark,
    });
    if (!ok) return false;
    try {
      await api.deleteMyCapsule(c.id);
      this.#drop(c.id);
      toast(`已删除《${c.title}》`);
      this.onChange?.();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "删除失败，请稍后再试", { tone: "error" });
      return false;
    }
  };

  /** 在「我收藏的」里取消收藏：从列表里拿掉 */
  onFavChange = (id: string, favorited: boolean) => {
    if (this.kind === "favorites" && !favorited) this.#drop(id);
    this.onChange?.();
  };
}

// ---------------------------------------------------------------- 资料与密码

export class ProfileForm {
  #nickname = $state("");
  avatarId = $state("");
  #pwd = $state({ current: "", next: "", confirm: "" });
  errors = $state<Errors>({});
  busy = $state(false);
  msg = $state.raw<FormMsg>(null);
  pwdBusy = $state(false);
  pwdMsg = $state.raw<FormMsg>(null);

  /** 昵称右侧的状态点：没改动时不显示 */
  nick = $derived<NickStateValue>(
    this.#nickname.trim() === authStore.user?.nickname ? "" : nickState(this.#nickname, this.errors).state,
  );
  nickHint = $derived(nickState(this.#nickname).hint);

  constructor() {
    this.#fill();
  }

  /** 从当前用户填好（MePage 按 user.id 加了 {#key}，换账号就是换一份表单） */
  #fill() {
    const u = untrack(() => authStore.user);
    if (u) {
      this.#nickname = u.nickname;
      this.avatarId = u.avatarId;
    }
  }

  get nickname() {
    return this.#nickname;
  }
  set nickname(v: string) {
    this.#nickname = v;
    delete this.errors.nickname;
    delete this.errors.nicknameState;
  }

  // 三个密码框：写入时收起该框的错误
  get current() {
    return this.#pwd.current;
  }
  set current(v: string) {
    this.#pwd.current = v;
    this.errors.current = undefined;
  }
  get next() {
    return this.#pwd.next;
  }
  set next(v: string) {
    this.#pwd.next = v;
    this.errors.next = undefined;
  }
  get confirm() {
    return this.#pwd.confirm;
  }
  set confirm(v: string) {
    this.#pwd.confirm = v;
    this.errors.confirm = undefined;
  }

  saveProfile = async () => {
    this.msg = null;
    this.errors = {};
    const u = authStore.user!;
    const patch: { nickname?: string; avatarId?: string } = {};
    if (this.#nickname.trim() !== u.nickname) patch.nickname = this.#nickname.trim();
    if (this.avatarId !== u.avatarId) patch.avatarId = this.avatarId;
    if (!Object.keys(patch).length) {
      toast("没有需要保存的修改", { tone: "info" });
      this.msg = { type: "info", text: "没有改动" };
      return;
    }
    if (patch.nickname != null && !NICK_RE.test(patch.nickname)) {
      this.errors.nickname = NICK_MSG;
      return;
    }
    this.busy = true;
    try {
      await api.updateProfile(patch);
      await authStore.refreshMe();
      this.msg = { type: "ok", text: "已保存" };
      toast("资料已更新");
    } catch (e) {
      const errs = fieldErrors(e, patch.nickname !== this.#nickname.trim());
      this.errors = errs;
      if (errs.form) this.msg = { type: "err", text: errs.form };
    } finally {
      this.busy = false;
    }
  };

  resetProfile = () => {
    this.#fill();
    this.errors = {};
    this.msg = null;
  };

  /** 离开「账号设置」页签：资料改回当前值，密码框清空 */
  reset = () => {
    this.resetProfile();
    this.#pwd = { current: "", next: "", confirm: "" };
    this.pwdMsg = null;
  };

  changePassword = async () => {
    this.pwdMsg = null;
    const { current, next, confirm } = this.#pwd;
    const errs: Errors = {};
    if (!current) errs.current = "请输入当前密码";
    else if (!pwdValid(next)) errs.next = "新密码至少 8 位，且同时包含字母和数字";
    else if (next !== confirm) errs.confirm = "两次输入的新密码不一致";
    this.errors = errs;
    if (Object.keys(errs).length) return;
    this.pwdBusy = true;
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      this.#pwd = { current: "", next: "", confirm: "" };
      this.pwdMsg = { type: "ok", text: "密码已更新。3 秒后将自动登出，请用新密码重新登录。" };
      setTimeout(() => {
        void authStore.logout(false).then(() => navigate("/login"));
      }, 3000);
    } catch (e) {
      this.pwdBusy = false;
      this.errors.current = e instanceof ApiError ? e.message : "修改失败，请稍后再试";
    }
  };
}

export const ME_TABS = ["created", "favorites", "profile"] as const;
export type MeTab = (typeof ME_TABS)[number];
export const isMeTab = (t: string): t is MeTab => (ME_TABS as readonly string[]).includes(t);

/** 「我的」路由的状态：页头统计 + 资料表单（切皮肤、切页签都还在） */
export interface MeState {
  readonly tab: MeTab;
  stats: MyStatsState;
  profile: ProfileForm;
}
const [getMe, setMe] = createContext<MeState>();
export const provideMe = setMe;
export const useMe = getMe;
