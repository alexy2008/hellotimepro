import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "@/components/MainLayout.vue";
import MeLayout from "@/components/MeLayout.vue";
import { useAuthStore } from "@/stores/auth";

import PlazaPage from "@/pages/PlazaPage.vue";
import OpenPage from "@/pages/OpenPage.vue";
import AboutPage from "@/pages/AboutPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import RegisterPage from "@/pages/RegisterPage.vue";
import CreatePage from "@/pages/CreatePage.vue";
import CapsuleByCodePage from "@/pages/CapsuleByCodePage.vue";
import MeCreatedPage from "@/pages/MeCreatedPage.vue";
import MeFavoritesPage from "@/pages/MeFavoritesPage.vue";
import MeProfilePage from "@/pages/MeProfilePage.vue";
import NotFoundPage from "@/pages/NotFoundPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", component: PlazaPage },
        { path: "open", component: OpenPage },
        { path: "about", component: AboutPage },
        { path: "login", component: LoginPage },
        { path: "register", component: RegisterPage },
        { path: "create", component: CreatePage, meta: { requiresAuth: true } },
        { path: "c/:code", component: CapsuleByCodePage },
      ],
    },
    {
      path: "/me",
      component: MeLayout,
      meta: { requiresAuth: true },
      children: [
        { path: "", redirect: "/me/created" },
        { path: "created", component: MeCreatedPage },
        { path: "favorites", component: MeFavoritesPage },
        { path: "profile", component: MeProfilePage },
      ],
    },
    { path: "/:pathMatch(.*)*", component: NotFoundPage },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// 未登录访问受保护路由 → 跳 /login，并把当前路径塞到 query.from
router.beforeEach((to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return true;
  const auth = useAuthStore();
  // 有 user 直接通过；只有 refreshToken（刷新页未拿到 access）也允许进入，
  // 接口调用会自动 refresh
  if (auth.user || auth.refreshToken) return true;
  return { path: "/login", query: { from: to.fullPath } };
});
