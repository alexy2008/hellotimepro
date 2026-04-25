import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import type { ReactNode } from "react";

// 路由守卫：未登录跳到 /login，并把当前 URL 放到 state 里以便登录后回跳
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);
  const location = useLocation();

  if (!hydrated) return null;

  // 有 user 直接通过；只有 refreshToken（刷新页未拿到 access）也允许进入，
  // 接口调用会自动 refresh
  if (user || refreshToken) return <>{children}</>;

  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
