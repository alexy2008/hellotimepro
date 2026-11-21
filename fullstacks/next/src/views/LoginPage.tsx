"use client";

import { useEffect, useState } from "react";
import { Navigate, useLocation } from "@/lib/router";
import { useUi } from "@/stores/ui";
import { useAuth } from "@/stores/auth";
import { safeRedirect } from "@/lib/redirect";
import { PaperLoginPage } from "@/skins/paper/AccountPages";
import { AmberLoginPage } from "@/skins/amber/AccountPages";

/**
 * 已登录时访问登录 / 注册页：直接去 redirect（或首页），不破坏当前会话。
 * 只在进入页面那一刻判断——页面里刚登录成功时由表单自己跳转，不能被这里抢先。
 */
export function useGuestRedirect(): string | null {
  const { search } = useLocation();
  const [to] = useState(() =>
    useAuth.getState().user ? safeRedirect(new URLSearchParams(search).get("redirect"), "/") : null,
  );
  return to;
}

export function LoginPage() {
  const skin = useUi((s) => s.skin);
  const to = useGuestRedirect();
  useEffect(() => {
    document.title = "登录 · HelloTime Pro";
  }, []);
  if (to) return <Navigate to={to} replace />;
  return skin === "paper" ? <PaperLoginPage /> : <AmberLoginPage />;
}
