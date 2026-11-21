"use client";
// ============================================================
// 客户端应用根：只在浏览器里渲染（ClientRoot 用 next/dynamic 关掉了 SSR）。
//
// 为什么不做服务端渲染：皮肤与明暗存在 localStorage（hellotime.skin / hellotime.theme），
// 服务端拿不到；两套皮肤的 DOM 结构差别很大，服务端按默认皮肤渲染再在客户端换掉，
// 会出现水合不一致和闪一下另一套。首帧颜色由根布局 <head> 的内联脚本先定好。
// ============================================================

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/stores/auth";
import { registerAvatars, type AvatarDef } from "@/lib/avatars";
import { Layout } from "@/components/AppLayout";

// 登录态在首次渲染之前从 localStorage 恢复：
// 守卫（未登录跳登录、已登录访问登录 / 注册页跳走）在第一帧就能拿到正确的 user
useAuth.getState().hydrate();

export default function App({ avatars, children }: { avatars: AvatarDef[]; children: ReactNode }) {
  registerAvatars(avatars);
  const refreshMe = useAuth((s) => s.refreshMe);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);

  // 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
  useEffect(() => {
    if (hydrated && refreshToken) void refreshMe();
  }, [hydrated, refreshToken, refreshMe]);

  return <Layout>{children}</Layout>;
}
