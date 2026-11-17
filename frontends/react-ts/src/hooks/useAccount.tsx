// ============================================================
// 账号相关的共享逻辑（两套皮肤共用）：登录、注册、「我的」三个页签、资料与密码
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { confirmDialog, toast } from "@/stores/feedback";
import { safeRedirect } from "@/lib/redirect";
import { AVATARS } from "@/lib/avatars";
import { ApiError, type CapsuleListItem, type MyStats } from "@/types";

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const NICK_RE = /^[一-龥A-Za-z0-9_-]{2,20}$/;
export const pwdRules = (v: string) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
export const pwdValid = (v: string) => {
  const r = pwdRules(v);
  return r.len && r.alpha && r.digit;
};

/** 昵称的即时检查：没有专门的唯一性接口，这里只做格式；重名在提交时由后端告诉我们 */
export function nickState(v: string): { state: "" | "valid" | "invalid"; hint?: string } {
  const t = v.trim();
  if (!t) return { state: "" };
  if (Array.from(t).length < 2) return { state: "", hint: "至少 2 个字符" };
  if (!NICK_RE.test(t)) return { state: "invalid", hint: "只能用中英文、数字、下划线和连字符" };
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
function fieldErrors(e: unknown, map: Record<string, string> = {}): Errors {
  if (!(e instanceof ApiError)) return { form: "网络异常，请稍后再试" };
  const out: Errors = {};
  for (const d of e.details ?? []) out[map[d.field] ?? d.field] = d.message;
  if (!Object.keys(out).length) out.form = e.message;
  return out;
}

// ---------------------------------------------------------------- 登录

export function useLogin() {
  const setTokens = useAuth((s) => s.setTokens);
  const navigate = useNavigate();
  const redirect = useRedirectParam();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(email: string, password: string) {
    const errs: Errors = {};
    if (!emailOk(email)) errs.email = "请输入有效的邮箱地址";
    else if (!password) errs.password = "请输入密码";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const t = await api.login({ email: email.trim(), password });
      setTokens(t);
      toast(`欢迎回来，${t.user.nickname}`);
      navigate(redirect ? safeRedirect(redirect, "/") : "/me/created", { replace: true });
    } catch (e) {
      // 不区分「邮箱不存在」与「密码错误」
      setErrors({ form: e instanceof ApiError && e.status === 401 ? "邮箱或密码不正确" : e instanceof ApiError ? e.message : "网络异常，请稍后再试" });
    } finally {
      setBusy(false);
    }
  }
  return { errors, setErrors, busy, submit, redirect };
}

// ---------------------------------------------------------------- 注册

export function useRegister() {
  const setTokens = useAuth((s) => s.setTokens);
  const navigate = useNavigate();
  const redirect = useRedirectParam();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(v: { email: string; nickname: string; password: string; avatarId: string }) {
    const errs: Errors = {};
    if (!emailOk(v.email)) errs.email = "请输入有效的邮箱地址";
    else if (!NICK_RE.test(v.nickname.trim())) errs.nickname = "昵称需为 2–20 个字符：中英文、数字、下划线或连字符";
    else if (!pwdValid(v.password)) errs.password = "密码至少 8 位，且同时包含字母和数字";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const t = await api.register({ email: v.email.trim(), nickname: v.nickname.trim(), password: v.password, avatarId: v.avatarId });
      setTokens(t);
      toast(`你好，${t.user.nickname}`);
      navigate(redirect ? safeRedirect(redirect, "/") : "/create", { replace: true });
    } catch (e) {
      setErrors(fieldErrors(e));
    } finally {
      setBusy(false);
    }
  }
  return { errors, setErrors, busy, submit, redirect };
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

/** 我创建的 / 我收藏的：一次取 50 枚（教学项目，够用） */
export function useMyList(kind: "created" | "favorites", onChange?: () => void) {
  const [items, setItems] = useState<CapsuleListItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = kind === "created" ? await api.myCapsules(1, 50) : await api.myFavorites(1, 50);
      setItems(r.items);
      setError(false);
    } catch {
      setError(true);
    }
  }, [kind]);
  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

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
      setItems((list) => (list ?? []).filter((i) => i.id !== c.id));
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
    if (kind === "favorites" && !favorited) setItems((list) => (list ?? []).filter((i) => i.id !== id));
    onChange?.();
  }

  return { items, error, reload: load, remove, onFavChange };
}

// ---------------------------------------------------------------- 资料与密码

export function useProfile() {
  const user = useAuth((s) => s.user)!;
  const refreshMe = useAuth((s) => s.refreshMe);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(user.nickname);
  const [avatarId, setAvatarId] = useState(user.avatarId);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
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
      setErrors({ nickname: "昵称需为 2–20 个字符：中英文、数字、下划线或连字符" });
      return;
    }
    setBusy(true);
    try {
      await api.updateProfile(patch);
      await refreshMe();
      setMsg({ type: "ok", text: "已保存" });
      toast("资料已更新");
    } catch (e) {
      const errs = fieldErrors(e);
      setErrors(errs);
      if (errs.form) setMsg({ type: "err", text: errs.form });
    } finally {
      setBusy(false);
    }
  }

  function resetProfile() {
    setNickname(user.nickname);
    setAvatarId(user.avatarId);
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
    setPwd: (k: "current" | "next" | "confirm", v: string) => {
      setPwd((p) => ({ ...p, [k]: v }));
      setErrors((e) => ({ ...e, [k]: undefined }));
    },
    pwdBusy,
    pwdMsg,
    changePassword,
  };
}
