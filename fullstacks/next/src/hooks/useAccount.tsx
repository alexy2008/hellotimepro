// ============================================================
// 账号相关的共享逻辑（两套皮肤共用）：登录、注册、「我的」三个页签、资料与密码
// - 表单内容放在内存 store 里：切换皮肤（视图组件整个换掉）时不丢（spec/ui/testids.md X5）；
//   离开该页面、提交成功、登出时清空，密码不会在内存里久留
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { create } from "zustand";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { confirmDialog, toast } from "@/stores/feedback";
import { safeRedirect } from "@/lib/redirect";
import { AVATARS } from "@/lib/avatars";
import { ApiError, type CapsuleListItem, type MyStats } from "@/types";

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const NICK_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
export const pwdRules = (v: string) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
export const pwdValid = (v: string) => {
  const r = pwdRules(v);
  return r.len && r.alpha && r.digit;
};

/** 昵称的即时检查：没有专门的唯一性接口，这里只做格式；重名在提交时由后端告诉我们 */
export function nickState(v: string, errors?: Errors): { state: "" | "valid" | "invalid" | "taken"; hint?: string } {
  if (errors?.nickname) return { state: errors.nicknameState === "taken" ? "taken" : "invalid", hint: errors.nickname };
  const t = v.trim();
  if (!t) return { state: "" };
  if (Array.from(t).length < 2) return { state: "", hint: "至少 2 个字符" };
  if (!NICK_RE.test(t)) return { state: "invalid", hint: "只能用字母、数字、下划线和连字符" };
  return { state: "valid" };
}

/** URL 上的 ?redirect= */
export function useRedirectParam() {
  const { search } = useLocation();
  return new URLSearchParams(search).get("redirect");
}

/** 头像列表：id 以后端 /avatars 为准（测试要求从后端加载），画法用本地内联的 v2 徽记 */
export function useAvatarIds() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    api
      .avatars()
      .then((list) => alive && setIds(list.map((a) => a.id)))
      .catch(() => alive && setIds(AVATARS.map((a) => a.id)));
    return () => {
      alive = false;
    };
  }, []);
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

// ---------------------------------------------------------------- 表单内容

interface LoginForm { email: string; password: string }
interface RegisterForm { email: string; nickname: string; password: string; avatarId: string }
interface ProfileForm { userId: string | null; nickname: string; avatarId: string }
interface PwdForm { current: string; next: string; confirm: string }

const blank = {
  login: (): LoginForm => ({ email: "", password: "" }),
  register: (): RegisterForm => ({ email: "", nickname: "", password: "", avatarId: "neo" }),
  profile: (): ProfileForm => ({ userId: null, nickname: "", avatarId: "" }),
  pwd: (): PwdForm => ({ current: "", next: "", confirm: "" }),
};
type FormKey = keyof typeof blank;
type Forms = { login: LoginForm; register: RegisterForm; profile: ProfileForm; pwd: PwdForm };

export const useForms = create<Forms>()(() => ({
  login: blank.login(),
  register: blank.register(),
  profile: blank.profile(),
  pwd: blank.pwd(),
}));

function patchForm<K extends FormKey>(k: K, p: Partial<Forms[K]>) {
  useForms.setState((s) => ({ [k]: { ...s[k], ...p } }) as Partial<Forms>);
}
function clearForm(...keys: FormKey[]) {
  useForms.setState(Object.fromEntries(keys.map((k) => [k, blank[k]()])) as Partial<Forms>);
}

// 登出 / 换账号：全部清空
useAuth.subscribe((s, prev) => {
  if (s.user?.id !== prev.user?.id && prev.user) clearForm("login", "register", "profile", "pwd");
});

/**
 * 离开页面时清空表单。切换皮肤也会卸载视图组件，但路由不变——
 * 卸载时地址栏已经不是这一页，才算真的离开
 */
function useClearOnLeave(path: string, ...keys: FormKey[]) {
  const keysRef = useRef(keys);
  useEffect(
    () => () => {
      if (window.location.pathname !== path) clearForm(...keysRef.current);
    },
    [path],
  );
}

// ---------------------------------------------------------------- 登录

export function useLogin() {
  const setTokens = useAuth((s) => s.setTokens);
  const navigate = useNavigate();
  const redirect = useRedirectParam();
  const form = useForms((s) => s.login);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  useClearOnLeave("/login", "login");

  async function submit() {
    const { email, password } = useForms.getState().login;
    const errs: Errors = {};
    if (!emailOk(email)) errs.email = "请输入有效的邮箱地址";
    else if (!password) errs.password = "请输入密码";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const t = await api.login({ email: email.trim(), password });
      setTokens(t);
      clearForm("login");
      toast(`欢迎回来，${t.user.nickname}`);
      navigate(redirect ? safeRedirect(redirect, "/") : "/me/created", { replace: true });
    } catch (e) {
      // 不区分「邮箱不存在」与「密码错误」
      setErrors({ form: e instanceof ApiError && e.status === 401 ? "邮箱或密码不正确" : e instanceof ApiError ? e.message : "网络异常，请稍后再试" });
    } finally {
      setBusy(false);
    }
  }
  return {
    ...form,
    setEmail: (email: string) => patchForm("login", { email }),
    setPassword: (password: string) => patchForm("login", { password }),
    errors,
    setErrors,
    busy,
    submit,
    redirect,
  };
}

// ---------------------------------------------------------------- 注册

export function useRegister() {
  const setTokens = useAuth((s) => s.setTokens);
  const navigate = useNavigate();
  const redirect = useRedirectParam();
  const form = useForms((s) => s.register);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  useClearOnLeave("/register", "register");

  async function submit() {
    const v = useForms.getState().register;
    const errs: Errors = {};
    if (!emailOk(v.email)) errs.email = "请输入有效的邮箱地址";
    else if (!NICK_RE.test(v.nickname.trim())) errs.nickname = "昵称需为 2–20 个字符：字母、数字、下划线或连字符";
    else if (!pwdValid(v.password)) errs.password = "密码至少 8 位，且同时包含字母和数字";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const t = await api.register({ email: v.email.trim(), nickname: v.nickname.trim(), password: v.password, avatarId: v.avatarId });
      setTokens(t);
      clearForm("register");
      toast(`你好，${t.user.nickname}`);
      navigate(redirect ? safeRedirect(redirect, "/") : "/create", { replace: true });
    } catch (e) {
      setErrors(fieldErrors(e, v.nickname !== useForms.getState().register.nickname));
    } finally {
      setBusy(false);
    }
  }
  const set = (k: keyof RegisterForm) => (v: string) => patchForm("register", { [k]: v });
  return {
    ...form,
    setEmail: set("email"),
    setNickname: (v: string) => {
      patchForm("register", { nickname: v });
      setErrors((e) => ({ ...e, nickname: undefined, nicknameState: undefined }));
    },
    setPassword: set("password"),
    setAvatarId: set("avatarId"),
    errors,
    setErrors,
    busy,
    submit,
    redirect,
  };
}

// ---------------------------------------------------------------- 「我的」

/** 页头统计：/me/stats；列表有增删时调用 refresh */
export function useMyStats() {
  const [stats, setStats] = useState<MyStats | null>(null);
  const refresh = useCallback(() => {
    api.myStats().then(setStats).catch(() => undefined);
  }, []);
  useEffect(refresh, [refresh]);
  return { stats, refresh };
}

const PAGE_SIZE = 20;

/** 我创建的 / 我收藏的：一页 20 枚，「加载更多」往后接（列表一直按时间倒序） */
export function useMyList(kind: "created" | "favorites", onChange?: () => void) {
  const [items, setItems] = useState<CapsuleListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const seq = useRef(0);

  const fetchPage = useCallback(
    (n: number) => (kind === "created" ? api.myCapsules(n, PAGE_SIZE) : api.myFavorites(n, PAGE_SIZE)),
    [kind],
  );

  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await fetchPage(1);
      if (my !== seq.current) return;
      setItems(r.items);
      setTotal(r.pagination.total);
      setError(false);
    } catch {
      if (my === seq.current) setError(true);
    }
  }, [fetchPage]);
  useEffect(() => {
    setItems(null);
    void load();
    return () => { seq.current++; };
  }, [load]);
  useEffect(() => {
    if (items?.length === 0 && total > 0) void load();
  }, [items, total, load]);

  /** 从已显示的条数推算下一条所在的页；删除后重读边界页，补上前移的记录。 */
  async function loadMore() {
    if (moreBusy) return;
    const my = seq.current;
    setMoreBusy(true);
    try {
      const r = await fetchPage(Math.floor((items?.length ?? 0) / PAGE_SIZE) + 1);
      if (my !== seq.current) return;
      setItems((list) => {
        const have = new Set((list ?? []).map((i) => i.id));
        return [...(list ?? []), ...r.items.filter((i) => !have.has(i.id))];
      });
      setTotal(r.pagination.total);
    } catch {
      if (my === seq.current) toast("加载失败，请稍后再试", { tone: "error" });
    } finally {
      if (my === seq.current) setMoreBusy(false);
    }
  }

  function drop(id: string) {
    seq.current++;
    setMoreBusy(false);
    setItems((list) => (list ?? []).filter((i) => i.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  /** 删除：确认框写明后果（spec/ui/copy.md §3） */
  async function remove(c: CapsuleListItem, mark?: React.ReactNode) {
    const ok = await confirmDialog({
      title: "删除这枚胶囊？",
      body: (
        <>
          <p>
            《{c.title}》会被永久删除。持有胶囊码 <b className="mono">{c.code}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。
          </p>
          <p className="dlg__warn">此操作不可恢复。</p>
        </>
      ),
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
    if (kind === "favorites" && !favorited) {
      drop(id);
    }
    onChange?.();
  }

  const hasMore = !!items && items.length < total;
  return { items, total, hasMore, moreBusy, loadMore, error, reload: load, remove, onFavChange };
}

// ---------------------------------------------------------------- 资料与密码

export function useProfile() {
  const user = useAuth((s) => s.user)!;
  const refreshMe = useAuth((s) => s.refreshMe);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  // 资料表单：第一次进来（或换了账号）时从当前用户填好；之后切皮肤也接着用 store 里正在改的值
  const stored = useForms((s) => s.profile);
  const prof = stored.userId === user.id ? stored : { userId: user.id, nickname: user.nickname, avatarId: user.avatarId };
  useEffect(() => {
    if (useForms.getState().profile.userId !== user.id) patchForm("profile", { userId: user.id, nickname: user.nickname, avatarId: user.avatarId });
  }, [user.id, user.nickname, user.avatarId]);
  const { nickname, avatarId } = prof;
  const setNickname = (v: string) => patchForm("profile", { ...prof, nickname: v });
  const setAvatarId = (v: string) => patchForm("profile", { ...prof, avatarId: v });
  const pwd = useForms((s) => s.pwd);
  useClearOnLeave("/me/profile", "profile", "pwd");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function saveProfile() {
    setMsg(null);
    setErrors({});
    const patch: { nickname?: string; avatarId?: string } = {};
    if (nickname.trim() !== user.nickname) patch.nickname = nickname.trim();
    if (avatarId !== user.avatarId) patch.avatarId = avatarId;
    if (!Object.keys(patch).length) {
      toast("没有需要保存的修改", { tone: "info" });
      setMsg({ type: "info", text: "没有改动" });
      return;
    }
    if (patch.nickname != null && !NICK_RE.test(patch.nickname)) {
      setErrors({ nickname: "昵称需为 2–20 个字符：字母、数字、下划线或连字符" });
      return;
    }
    setBusy(true);
    try {
      await api.updateProfile(patch);
      await refreshMe();
      setMsg({ type: "ok", text: "已保存" });
      toast("资料已更新");
    } catch (e) {
      const errs = fieldErrors(e, nickname !== useForms.getState().profile.nickname);
      setErrors(errs);
      if (errs.form) setMsg({ type: "err", text: errs.form });
    } finally {
      setBusy(false);
    }
  }

  function resetProfile() {
    patchForm("profile", { userId: user.id, nickname: user.nickname, avatarId: user.avatarId });
    setErrors({});
    setMsg(null);
  }

  async function changePassword() {
    setPwdMsg(null);
    const errs: Errors = {};
    if (!pwd.current) errs.current = "请输入当前密码";
    else if (!pwdValid(pwd.next)) errs.next = "新密码至少 8 位，且同时包含字母和数字";
    else if (pwd.next !== pwd.confirm) errs.confirm = "两次输入的新密码不一致";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPwdBusy(true);
    try {
      await api.changePassword({ currentPassword: pwd.current, newPassword: pwd.next });
      clearForm("pwd");
      setPwdMsg({ type: "ok", text: "密码已更新。3 秒后将自动登出，请用新密码重新登录。" });
      setTimeout(() => {
        void logout(false).then(() => navigate("/login"));
      }, 3000);
    } catch (e) {
      setPwdBusy(false);
      setErrors({ current: e instanceof ApiError ? e.message : "修改失败，请稍后再试" });
    }
  }

  return {
    user,
    nickname,
    setNickname: (v: string) => {
      setNickname(v);
      setErrors((e) => ({ ...e, nickname: undefined }));
    },
    avatarId,
    setAvatarId,
    errors,
    busy,
    msg,
    saveProfile,
    resetProfile,
    pwd,
    setPwd: (k: keyof PwdForm, v: string) => {
      patchForm("pwd", { [k]: v });
      setErrors((e) => ({ ...e, [k]: undefined }));
    },
    pwdBusy,
    pwdMsg,
    changePassword,
  };
}
