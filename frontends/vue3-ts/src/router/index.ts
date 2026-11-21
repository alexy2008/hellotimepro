// ============================================================
// 路由表（与 docs/01-requirements.md §4.9 一致）+ 导航守卫
// - meta.requiresAuth：未登录跳 /login?redirect=<当前路径>；本地只剩 refresh token 时先静默续期再判断
// - meta.guestOnly：已登录时访问登录 / 注册页，直接去 redirect（或首页），不破坏当前会话
// - /me/:tab 用正则参数只认三个页签，其余 /me/* 回到「我创建的」
// ============================================================

import { createRouter, createWebHistory, type LocationQueryRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { loginPath, safeRedirect } from "@/lib/redirect";
import { provideCodeOpen } from "@/composables/useCodeOpen";
import { provideCreateForm } from "@/composables/useCreateCapsule";
import { skinned } from "./skinned";

import PaperHomePage from "@/skins/paper/PaperHomePage.vue";
import PaperOpenPage from "@/skins/paper/PaperOpenPage.vue";
import PaperCapsulePage from "@/skins/paper/PaperCapsulePage.vue";
import PaperCreatePage from "@/skins/paper/PaperCreatePage.vue";
import PaperLoginPage from "@/skins/paper/PaperLoginPage.vue";
import PaperRegisterPage from "@/skins/paper/PaperRegisterPage.vue";
import PaperMePage from "@/skins/paper/PaperMePage.vue";
import PaperAboutPage from "@/skins/paper/PaperAboutPage.vue";
import PaperNotFoundPage from "@/skins/paper/PaperNotFoundPage.vue";
import AmberHomePage from "@/skins/amber/AmberHomePage.vue";
import AmberOpenPage from "@/skins/amber/AmberOpenPage.vue";
import AmberCapsulePage from "@/skins/amber/AmberCapsulePage.vue";
import AmberCreatePage from "@/skins/amber/AmberCreatePage.vue";
import AmberLoginPage from "@/skins/amber/AmberLoginPage.vue";
import AmberRegisterPage from "@/skins/amber/AmberRegisterPage.vue";
import AmberMePage from "@/skins/amber/AmberMePage.vue";
import AmberAboutPage from "@/skins/amber/AmberAboutPage.vue";
import AmberNotFoundPage from "@/skins/amber/AmberNotFoundPage.vue";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

const SUFFIX = " · HelloTime Pro";

/**
 * 查询串一律用 encodeURIComponent 编码（与 lib/redirect 的 loginPath 同一种写法）。
 * Vue Router 默认的编码会保留「/」，守卫里返回的跳转目标会被它重新拼一遍，
 * 变成 /login?redirect=/create；spec 要求 redirect 原样保留为 /login?redirect=%2Fcreate（X7）
 */
function stringifyQuery(query: LocationQueryRaw = {}): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item === undefined) continue;
      parts.push(item === null ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.join("&");
}

export const router = createRouter({
  history: createWebHistory(),
  stringifyQuery,
  routes: [
    { path: "/", component: skinned("PlazaPage", { paper: PaperHomePage, amber: AmberHomePage }, { setup: provideCodeOpen }), meta: { title: "把此刻寄给未来" } },
    { path: "/open", component: skinned("OpenPage", { paper: PaperOpenPage, amber: AmberOpenPage }, { setup: provideCodeOpen }), meta: { title: "开启胶囊" } },
    { path: "/about", component: skinned("AboutPage", { paper: PaperAboutPage, amber: AmberAboutPage }), meta: { title: "关于" } },
    { path: "/login", component: skinned("LoginPage", { paper: PaperLoginPage, amber: AmberLoginPage }), meta: { title: "登录", guestOnly: true } },
    { path: "/register", component: skinned("RegisterPage", { paper: PaperRegisterPage, amber: AmberRegisterPage }), meta: { title: "注册", guestOnly: true } },
    {
      path: "/create",
      component: skinned("CreatePage", { paper: PaperCreatePage, amber: AmberCreatePage }, { needsUser: true, setup: provideCreateForm }),
      meta: { title: "写给未来", requiresAuth: true },
    },
    // 详情页的标题等胶囊取回来后由 useCapsuleByCode 写
    { path: "/capsules/:code", component: skinned("CapsulePage", { paper: PaperCapsulePage, amber: AmberCapsulePage }) },
    { path: "/me", redirect: "/me/created" },
    {
      // 三个页签共用一条路由：切页签只是参数变化，页头与统计不重新挂载
      path: "/me/:tab(created|favorites|profile)",
      component: skinned("MePage", { paper: PaperMePage, amber: AmberMePage }, { needsUser: true }),
      meta: { title: "我的", requiresAuth: true },
    },
    { path: "/me/:rest(.*)", redirect: "/me/created" },
    { path: "/:pathMatch(.*)*", component: skinned("NotFoundPage", { paper: PaperNotFoundPage, amber: AmberNotFoundPage }), meta: { title: "查无此页" } },
  ],
  // 换页回到顶部；同一页只改查询串时不动
  scrollBehavior: (to, from) => (to.path !== from.path ? { top: 0 } : false),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.guestOnly && auth.user) {
    const r = to.query.redirect;
    return safeRedirect(typeof r === "string" ? r : null, "/");
  }
  if (to.meta.requiresAuth) {
    // 只有 refresh token（user 还没拿到）：接口会自动续期，先把 user 取回来
    if (!auth.user && auth.refreshToken) await auth.refreshMe();
    if (!auth.user) return loginPath(to.fullPath);
  }
  return true;
});

/** 路由名：写到 body[data-route]，个别皮肤样式按页面微调 */
function routeName(path: string): string {
  if (path === "/") return "plaza";
  if (path.startsWith("/capsules/")) return "capsule";
  if (path.startsWith("/me")) return "me";
  return path.slice(1).split("/")[0] || "plaza";
}

router.afterEach((to) => {
  document.body.dataset.route = routeName(to.path);
  if (to.meta.title) document.title = to.meta.title + SUFFIX;
});
