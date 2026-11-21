// ============================================================
// 账号相关的共享逻辑（两套皮肤共用）：登录、注册、「我的」三个页签、资料与密码
//
// 这些 primitive 都由路由页（或「我的」里按页签建的那一份）创建，再交给皮肤视图：
// - 切换皮肤只换视图，表单里填了一半的内容、错误提示、进行中的请求都还在（spec/ui/testids.md X5）
// - 离开页面时整份状态随路由销毁，等于清空——密码不会在内存里久留；提交成功时也主动清空
// ============================================================

import { batch, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { api } from "@/api/client";
import { auth, logout, refreshMe, setTokens } from "@/stores/auth";
import { confirmDialog, toast } from "@/stores/feedback";
import { safeRedirect } from "@/lib/redirect";
import { AVATARS } from "@/lib/avatars";
import { NICK_RE, emailOk, fieldErrors, nickState, pwdValid, type Errors } from "@/lib/account";
import { ApiError, type CapsuleListItem, type MyStats } from "@/types";
import type { JSX } from "solid-js";

/** URL 上的 ?redirect=（响应式） */
export function useRedirectParam() {
  const location = useLocation();
  return () => new URLSearchParams(location.search).get("redirect");
}

/** 头像列表：id 以后端 /avatars 为准（测试要求从后端加载），画法用本地内联的 v2 徽记 */
export function createAvatarIds() {
  const [ids, setIds] = createSignal<string[]>([]);
  let alive = true;
  onCleanup(() => (alive = false));
  api
    .avatars()
    .then((list) => alive && setIds(list.map((a) => a.id)))
    .catch(() => alive && setIds(AVATARS.map((a) => a.id)));
  return ids;
}

// ---------------------------------------------------------------- 登录

export function createLogin() {
  const navigate = useNavigate();
  const redirect = useRedirectParam();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [errors, setErrors] = createSignal<Errors>({});
  const [busy, setBusy] = createSignal(false);

  async function submit() {
    const errs: Errors = {};
    if (!emailOk(email())) errs.email = "请输入有效的邮箱地址";
    else if (!password()) errs.password = "请输入密码";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const t = await api.login({ email: email().trim(), password: password() });
      setTokens(t);
      batch(() => {
        setEmail("");
        setPassword("");
      });
      toast(`欢迎回来，${t.user.nickname}`);
      const r = redirect();
      navigate(r ? safeRedirect(r, "/") : "/me/created", { replace: true });
    } catch (e) {
      // 不区分「邮箱不存在」与「密码错误」
      setErrors({ form: e instanceof ApiError && e.status === 401 ? "邮箱或密码不正确" : e instanceof ApiError ? e.message : "网络异常，请稍后再试" });
    } finally {
      setBusy(false);
    }
  }

  return { email, setEmail, password, setPassword, errors, setErrors, busy, submit, redirect };
}

export type LoginForm = ReturnType<typeof createLogin>;

// ---------------------------------------------------------------- 注册

export function createRegister() {
  const navigate = useNavigate();
  const redirect = useRedirectParam();
  const [email, setEmail] = createSignal("");
  const [nickname, setNicknameRaw] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [avatarId, setAvatarId] = createSignal("neo");
  const [errors, setErrors] = createSignal<Errors>({});
  const [busy, setBusy] = createSignal(false);

  async function submit() {
    const errs: Errors = {};
    if (!emailOk(email())) errs.email = "请输入有效的邮箱地址";
    else if (!NICK_RE.test(nickname().trim())) errs.nickname = "昵称需为 2–20 个字符：字母、数字、下划线或连字符";
    else if (!pwdValid(password())) errs.password = "密码至少 8 位，且同时包含字母和数字";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const sent = nickname();
    try {
      const t = await api.register({ email: email().trim(), nickname: sent.trim(), password: password(), avatarId: avatarId() });
      setTokens(t);
      batch(() => {
        setEmail("");
        setNicknameRaw("");
        setPassword("");
        setAvatarId("neo");
      });
      toast(`你好，${t.user.nickname}`);
      const r = redirect();
      navigate(r ? safeRedirect(r, "/") : "/create", { replace: true });
    } catch (e) {
      setErrors(fieldErrors(e, sent !== nickname()));
    } finally {
      setBusy(false);
    }
  }

  return {
    email,
    setEmail,
    nickname,
    setNickname: (v: string) => {
      setNicknameRaw(v);
      setErrors((e) => ({ ...e, nickname: undefined, nicknameState: undefined }));
    },
    password,
    setPassword,
    avatarId,
    setAvatarId,
    errors,
    busy,
    submit,
    redirect,
    nick: createMemo(() => nickState(nickname(), errors())),
  };
}

export type RegisterForm = ReturnType<typeof createRegister>;

// ---------------------------------------------------------------- 「我的」

/** 页头统计：/me/stats；列表有增删时调用 refresh */
export function createMyStats() {
  const [stats, setStats] = createSignal<MyStats | null>(null);
  const refresh = () => {
    api.myStats().then(setStats).catch(() => undefined);
  };
  refresh();
  return { stats, refresh };
}

export type MyStatsState = ReturnType<typeof createMyStats>;

const PAGE_SIZE = 20;

/** 我创建的 / 我收藏的：一页 20 枚，「加载更多」往后接（列表一直按时间倒序） */
export function createMyList(kind: "created" | "favorites", onChange?: () => void) {
  const [items, setItems] = createSignal<CapsuleListItem[] | null>(null);
  const [total, setTotal] = createSignal(0);
  const [error, setError] = createSignal(false);
  const [moreBusy, setMoreBusy] = createSignal(false);
  let seq = 0;
  onCleanup(() => seq++);

  const fetchPage = (n: number) => (kind === "created" ? api.myCapsules(n, PAGE_SIZE) : api.myFavorites(n, PAGE_SIZE));

  async function load() {
    const my = ++seq;
    try {
      const r = await fetchPage(1);
      if (my !== seq) return;
      batch(() => {
        setItems(r.items);
        setTotal(r.pagination.total);
        setError(false);
      });
    } catch {
      if (my === seq) setError(true);
    }
  }
  void load();

  // 删光了这一页、服务端却还有：重新从第一页取
  createEffect(() => {
    if (items()?.length === 0 && total() > 0) void load();
  });

  /** 从已显示的条数推算下一条所在的页；删除后重读边界页，补上前移的记录，按 id 去重 */
  async function loadMore() {
    if (moreBusy()) return;
    const my = seq;
    setMoreBusy(true);
    try {
      const r = await fetchPage(Math.floor((items()?.length ?? 0) / PAGE_SIZE) + 1);
      if (my !== seq) return;
      batch(() => {
        setItems((list) => {
          const have = new Set((list ?? []).map((i) => i.id));
          return [...(list ?? []), ...r.items.filter((i) => !have.has(i.id))];
        });
        setTotal(r.pagination.total);
      });
    } catch {
      if (my === seq) toast("加载失败，请稍后再试", { tone: "error" });
    } finally {
      if (my === seq) setMoreBusy(false);
    }
  }

  /** 从列表里拿掉一枚：进行中的「加载更多」作废（它是按删除前的条数算的页） */
  function drop(id: string) {
    seq++;
    batch(() => {
      setMoreBusy(false);
      setItems((list) => (list ?? []).filter((i) => i.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    });
  }

  /** 删除：确认框写明后果（spec/ui/copy.md §3）；mark 是皮肤给的小插画。标题是用户写的，作为文本插入 */
  async function remove(c: CapsuleListItem, mark?: () => JSX.Element) {
    const ok = await confirmDialog({
      title: "删除这枚胶囊？",
      body: () => (
        <>
          <p>
            《{c.title}》会被永久删除。持有胶囊码 <b class="mono">{c.code}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。
          </p>
          <p class="dlg__warn">此操作不可恢复。</p>
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
    if (kind === "favorites" && !favorited) drop(id);
    onChange?.();
  }

  const hasMore = createMemo(() => !!items() && items()!.length < total());
  return { kind, items, total, hasMore, moreBusy, loadMore, error, reload: load, remove, onFavChange };
}

export type MyList = ReturnType<typeof createMyList>;

// ---------------------------------------------------------------- 资料与密码

export function createProfile() {
  const navigate = useNavigate();
  // 资料表单：进来时从当前用户填好；之后切皮肤也接着用正在改的值
  const user = () => auth.user!;
  const [nickname, setNicknameRaw] = createSignal(user().nickname);
  const [avatarId, setAvatarId] = createSignal(user().avatarId);
  const [pwd, setPwdState] = createSignal({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = createSignal<Errors>({});
  const [busy, setBusy] = createSignal(false);
  const [msg, setMsg] = createSignal<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = createSignal(false);
  const [pwdMsg, setPwdMsg] = createSignal<{ type: "ok" | "err"; text: string } | null>(null);

  async function saveProfile() {
    setMsg(null);
    setErrors({});
    const u = user();
    const sent = nickname();
    const patch: { nickname?: string; avatarId?: string } = {};
    if (sent.trim() !== u.nickname) patch.nickname = sent.trim();
    if (avatarId() !== u.avatarId) patch.avatarId = avatarId();
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
      const errs = fieldErrors(e, sent !== nickname());
      setErrors(errs);
      if (errs.form) setMsg({ type: "err", text: errs.form });
    } finally {
      setBusy(false);
    }
  }

  function resetProfile() {
    batch(() => {
      setNicknameRaw(user().nickname);
      setAvatarId(user().avatarId);
      setErrors({});
      setMsg(null);
    });
  }

  async function changePassword() {
    setPwdMsg(null);
    const p = pwd();
    const errs: Errors = {};
    if (!p.current) errs.current = "请输入当前密码";
    else if (!pwdValid(p.next)) errs.next = "新密码至少 8 位，且同时包含字母和数字";
    else if (p.next !== p.confirm) errs.confirm = "两次输入的新密码不一致";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPwdBusy(true);
    try {
      await api.changePassword({ currentPassword: p.current, newPassword: p.next });
      setPwdState({ current: "", next: "", confirm: "" });
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
      setNicknameRaw(v);
      setErrors((e) => ({ ...e, nickname: undefined }));
    },
    avatarId,
    setAvatarId,
    /** 昵称状态点：没改（与当前昵称相同）时不显示 */
    nick: createMemo(() => nickState(nickname(), errors())),
    nickChanged: () => nickname().trim() !== user().nickname,
    errors,
    busy,
    msg,
    saveProfile,
    resetProfile,
    pwd,
    setPwd: (k: "current" | "next" | "confirm", v: string) => {
      setPwdState((p) => ({ ...p, [k]: v }));
      setErrors((e) => ({ ...e, [k]: undefined }));
    },
    pwdBusy,
    pwdMsg,
    changePassword,
  };
}

export type ProfileForm = ReturnType<typeof createProfile>;
