import { loginPath, safeRedirect } from "@/lib/redirect";

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const auth = useAuthStore();
  auth.hydrate();
  if (!auth.user && auth.refreshToken) await auth.refreshMe();

  if (to.meta.requiresAuth && !auth.user) return navigateTo(loginPath(to.fullPath));
  if (to.meta.guestOnly && auth.user) {
    const target = typeof to.query.redirect === "string" ? to.query.redirect : null;
    return navigateTo(safeRedirect(target, "/"));
  }
});
