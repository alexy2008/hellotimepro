import { useAuthStore, wireAuthApi } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";

export default defineNuxtPlugin(() => {
  wireAuthApi();

  const theme = useThemeStore();
  const auth = useAuthStore();

  theme.hydrate();
  auth.hydrate();

  // 不在引导时急切 refreshMe：登录态由持久化的 user 渲染（hydrate 已同步恢复），
  // access token 留给真正的 authed 请求惰性刷新。否则在「整页 reload 序列」下，
  // 上一页的刷新会轮换并吊销 refresh token，但响应未及持久化就被下一次导航打断，
  // 下一页用旧 token 再刷新会触发重用检测、整族吊销 → 误登出（smoke:32）。
});
