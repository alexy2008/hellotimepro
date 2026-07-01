// 路由守卫：未登录跳到 /login。
// 行为对齐 frontends/react-ts/src/components/AuthGate.tsx：
//   - 未 hydrate 完不渲染（splash 仍在）
//   - 有 user 或仅有 refreshToken 都放行（接口调用会自动 refresh）
//   - 否则重定向到登录

import { type ReactNode } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/stores/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const refreshToken = useAuth((s) => s.refreshToken);

  if (!hydrated) return null;
  if (user || refreshToken) return <>{children}</>;
  return <Redirect href="/login" />;
}
