import { useAuthStore } from "@/stores/auth";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (auth.user || auth.refreshToken) return;
  return navigateTo({ path: "/login", query: { from: to.fullPath } });
});
