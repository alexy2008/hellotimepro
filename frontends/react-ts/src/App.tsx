import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";

export function App() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const refreshMe = useAuth((s) => s.refreshMe);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);
  const hydrateTheme = useTheme((s) => s.hydrate);

  useEffect(() => {
    hydrateTheme();
    hydrateAuth();
  }, [hydrateAuth, hydrateTheme]);

  // 一旦完成 hydrate，且本地有 refresh token 但还没拿到完整 user 信息，
  // 主动拉一次 /me 验证登录态
  useEffect(() => {
    if (hydrated && refreshToken) {
      void refreshMe();
    }
  }, [hydrated, refreshToken, refreshMe]);

  return <RouterProvider router={router} />;
}
