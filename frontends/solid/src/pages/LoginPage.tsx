import { untrack } from "solid-js";
import { Navigate, useLocation } from "@solidjs/router";
import { auth } from "@/stores/auth";
import { safeRedirect } from "@/lib/redirect";
import { createLogin } from "@/primitives/account";
import { PaperLoginPage } from "@/skins/paper/AccountPages";
import { AmberLoginPage } from "@/skins/amber/AccountPages";
import { Skinned } from "./Skinned";

/**
 * 已登录时访问登录 / 注册页：直接去 redirect（或首页），不破坏当前会话。
 * 只在进入页面那一刻判断——页面里刚登录成功时由表单自己跳转，不能被这里抢先
 */
export function guestRedirect(): string | null {
  const location = useLocation();
  return untrack(() => (auth.user ? safeRedirect(new URLSearchParams(location.search).get("redirect"), "/") : null));
}

export function LoginPage() {
  const to = guestRedirect();
  if (to) return <Navigate href={to} />;
  document.title = "登录 · HelloTime Pro";
  return <LoginForm />;
}

function LoginForm() {
  const f = createLogin();
  return <Skinned paper={<PaperLoginPage f={f} />} amber={<AmberLoginPage f={f} />} />;
}
