import { onMount } from "solid-js";
import { Navigate, Route, Router } from "@solidjs/router";
import { Layout } from "@/app/Layout";
import { AuthGate } from "@/components/AuthGate";
import { auth, refreshMe } from "@/stores/auth";

import { PlazaPage } from "@/pages/PlazaPage";
import { OpenPage } from "@/pages/OpenPage";
import { AboutPage } from "@/pages/AboutPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CreatePage } from "@/pages/CreatePage";
import { CapsuleByCodePage } from "@/pages/CapsuleByCodePage";
import { MePage } from "@/pages/MePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// 需要登录的页面套一层守卫
const GatedCreate = () => (
  <AuthGate>
    <CreatePage />
  </AuthGate>
);
const GatedMe = () => (
  <AuthGate>
    <MePage />
  </AuthGate>
);
const ToMyCreated = () => <Navigate href="/me/created" />;

// 路由表与 docs/01-requirements.md §4.9 一致；详情页统一按胶囊码打开
export function App() {
  // 皮肤与明暗在 index.html 的内联脚本里已经写好，登录态在 main.tsx 里已恢复；
  // 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
  onMount(() => {
    if (auth.refreshToken) void refreshMe();
  });

  return (
    <Router root={Layout}>
      <Route path="/" component={PlazaPage} />
      <Route path="/open" component={OpenPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/create" component={GatedCreate} />
      <Route path="/capsules/:code" component={CapsuleByCodePage} />
      <Route path="/me" component={ToMyCreated} />
      <Route path="/me/:tab" component={GatedMe} />
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
