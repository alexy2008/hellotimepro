import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { useAuth } from "@/stores/auth";

export function App() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const refreshMe = useAuth((s) => s.refreshMe);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);

  // 皮肤与明暗在 index.html 的内联脚本里已经写好（首帧之前），这里只恢复登录态
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
  useEffect(() => {
    if (hydrated && refreshToken) void refreshMe();
  }, [hydrated, refreshToken, refreshMe]);

  return <RouterProvider router={router} />;
}
