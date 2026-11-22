"use client";
// ============================================================
// 客户端应用根（Client Component，参与服务端渲染）。
//
// 根布局（Server Component）在服务端算好四样东西传进来：
// - prefs：按 Cookie 算出的皮肤 / 明暗 → UiSeedContext（服务端渲染与水合那一次用它）
// - serverNow：服务端渲染时刻 → NowSeedContext（倒计时两边用同一时刻，避免文字水合不匹配）
// - health：/health 技术栈 → HealthContext（页脚、关于页不用再请求）
// - avatars：spec/avatars/v2 头像表
//
// 登录态只存在浏览器（localStorage），服务端一律按匿名渲染；水合完成后在 layout effect 里恢复，
// 依赖登录态的部分（页头头像、守卫、收藏状态）随即按真实用户重渲。
// ============================================================

import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useAuth } from "@/stores/auth";
import { UiSeedContext, useUi } from "@/stores/ui";
import { NowSeedContext } from "@/hooks/useNow";
import { HealthContext } from "@/components/shared";
import { registerAvatars, type AvatarDef } from "@/lib/avatars";
import type { UiPrefs } from "@/lib/preferences";
import type { HealthData } from "@/types";
import { Layout } from "@/components/AppLayout";

interface Props {
  avatars: AvatarDef[];
  prefs: UiPrefs;
  health: HealthData;
  serverNow: number;
  children: ReactNode;
}

export function App({ avatars, prefs, health, serverNow, children }: Props) {
  registerAvatars(avatars);
  const refreshMe = useAuth((s) => s.refreshMe);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);

  // 恢复登录态：layout effect 早于所有 passive effect，页面里的取数、守卫第一次运行时就能拿到
  useLayoutEffect(() => {
    useAuth.getState().hydrate();
  }, []);

  // 水合后把 Cookie 校正为当前偏好（localStorage 为准），下一次服务端渲染就直接对了
  useEffect(() => {
    useUi.getState().syncCookies();
  }, []);

  // 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
  useEffect(() => {
    if (hydrated && refreshToken) void refreshMe();
  }, [hydrated, refreshToken, refreshMe]);

  return (
    <UiSeedContext.Provider value={prefs}>
      <NowSeedContext.Provider value={serverNow}>
        <HealthContext.Provider value={health}>
          <Layout>{children}</Layout>
        </HealthContext.Provider>
      </NowSeedContext.Provider>
    </UiSeedContext.Provider>
  );
}
