import { createEffect, onMount, untrack, type JSX } from "solid-js";
import { Router, Route, Navigate } from "@solidjs/router";
import { MainLayout } from "@/components/MainLayout";
import { MeLayout } from "@/components/MeLayout";
import { AuthGate } from "@/components/AuthGate";
import { auth, hydrateAuth, refreshMe } from "@/stores/auth";
import { hydrateTheme } from "@/stores/theme";

import { PlazaPage } from "@/pages/PlazaPage";
import { OpenPage } from "@/pages/OpenPage";
import { AboutPage } from "@/pages/AboutPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CreatePage } from "@/pages/CreatePage";
import { CapsuleByCodePage } from "@/pages/CapsuleByCodePage";
import { MeCreatedPage } from "@/pages/MeCreatedPage";
import { MeFavoritesPage } from "@/pages/MeFavoritesPage";
import { MeProfilePage } from "@/pages/MeProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// 受保护的个人中心布局：守卫 + 布局 + 子路由 outlet
function MeShell(props: { children?: JSX.Element }) {
  return (
    <AuthGate>
      <MeLayout>{props.children}</MeLayout>
    </AuthGate>
  );
}

export function App() {
  onMount(() => {
    hydrateTheme();
    hydrateAuth();
  });

  // 一旦完成 hydrate，且本地有 refresh token 但还没拿到完整 user 信息（!auth.user），
  // 主动拉一次 /me 验证登录态。加 !auth.user 避免登录 setTokens / token 轮换改动 refreshToken
  // 时重复触发 /me；用 untrack 包住调用，确保 refreshMe 内部读取不被纳入本 effect 依赖。
  createEffect(() => {
    if (auth.hydrated && auth.refreshToken && !auth.user) {
      untrack(() => void refreshMe());
    }
  });

  return (
    <Router>
      <Route component={MainLayout}>
        <Route path="/" component={PlazaPage} />
        <Route path="/open" component={OpenPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route
          path="/create"
          component={() => (
            <AuthGate>
              <CreatePage />
            </AuthGate>
          )}
        />
        <Route path="/c/:code" component={CapsuleByCodePage} />
      </Route>
      <Route component={MeShell}>
        <Route path="/me" component={() => <Navigate href="/me/created" />} />
        <Route path="/me/created" component={MeCreatedPage} />
        <Route path="/me/favorites" component={MeFavoritesPage} />
        <Route path="/me/profile" component={MeProfilePage} />
      </Route>
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
