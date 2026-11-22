"use client";

import { useState } from "react";
import { Navigate, useLocation } from "@/lib/router";
import { useUi } from "@/stores/ui";
import { useAuth } from "@/stores/auth";
import { safeRedirect } from "@/lib/redirect";
import { PaperLoginPage } from "@/skins/paper/AccountPages";
import { AmberLoginPage } from "@/skins/amber/AccountPages";

/**
 * 已登录时访问登录 / 注册页：直接去 redirect（或首页），不破坏当前会话。
 * 只在进入页面、登录态已知的那一刻判断一次——页面里刚登录成功时由表单自己跳转，不能被这里抢先。
 *
 * 服务端渲染与水合时登录态还不知道（令牌在 localStorage，components/App 水合后才恢复），
 * 这时先按未登录渲染表单；恢复完成后的第一次渲染再定。客户端内导航进来时登录态早已恢复，当场就定。
 */
export function useGuestRedirect(): string | null {
  const { search } = useLocation();
  const authReady = useAuth((s) => s.hydrated);
  const decide = () => (useAuth.getState().user ? safeRedirect(new URLSearchParams(search).get("redirect"), "/") : null);
  // undefined = 还没判断过
  const [to, setTo] = useState<string | null | undefined>(() => (authReady ? decide() : undefined));
  if (to === undefined && authReady) {
    const v = decide();
    setTo(v);
    return v;
  }
  return to ?? null;
}

export function LoginPage() {
  const skin = useUi((s) => s.skin);
  const to = useGuestRedirect();
  if (to) return <Navigate to={to} replace />;
  return skin === "paper" ? <PaperLoginPage /> : <AmberLoginPage />;
}
