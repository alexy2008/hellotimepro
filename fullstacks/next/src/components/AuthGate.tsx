"use client";

import { Navigate, useLocation } from "@/lib/router";
import { useAuth } from "@/stores/auth";
import { loginPath } from "@/lib/redirect";
import type { ReactNode } from "react";

// 路由守卫：未登录跳到 /login?redirect=<当前路径含查询串>，登录后回跳。
// 登录态只在浏览器里（localStorage），服务端渲染与水合时 hydrated 为 false，这里什么也不输出；
// components/App 水合后恢复登录态，守卫随即放行或跳转（Navigate 在 effect 里执行，见 lib/router）。
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);
  const location = useLocation();

  if (!hydrated) return null;

  // 有 user 直接通过；只有 refreshToken（刷新页未拿到 access）也允许进入，
  // 接口调用会自动 refresh
  if (user || refreshToken) return <>{children}</>;

  return <Navigate to={loginPath(location.pathname + location.search)} replace />;
}
