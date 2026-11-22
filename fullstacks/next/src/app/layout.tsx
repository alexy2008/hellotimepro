// ============================================================
// 根布局（Server Component）：<html>、首帧脚本、全局样式，以及客户端应用外壳。
//
// - 样式原样引入 spec/styles（base → 时笺三件 → 琥珀三件 → shell），见 app/styles.css
// - 皮肤与明暗读 Cookie（ht-skin / ht-theme）：服务端据此写 <html data-skin data-theme>，
//   并渲染对应皮肤的外壳与页面；localStorage 与 Cookie 不一致时由首帧脚本纠正（lib/preferences.ts）
// - 头像表、/health 技术栈、服务端此刻都在这里算好，作为 props 交给客户端应用根（components/App）
// - 读了 Cookie，所有页面都是按请求动态渲染的（不做静态预渲染）
// ============================================================
import "./styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { App } from "@/components/App";
import { avatarCatalog } from "@/lib/server/avatar-catalog";
import { loadHealth } from "@/lib/server/page-data";
import { FIRST_FRAME_SCRIPT, THEME_COLOR, prefsFromCookies } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "HelloTime Pro · 把此刻寄给未来",
  description: "写一段话，设定未来某一刻才能开启。",
  icons: { icon: { url: "/logo.svg", type: "image/svg+xml" } },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const prefs = prefsFromCookies((name) => jar.get(name)?.value);

  return (
    // 首帧脚本可能按 localStorage 改写 data-skin / data-theme（与 Cookie 不一致时），属性不一致是预期的
    <html lang="zh-CN" data-skin={prefs.skin} data-theme={prefs.theme} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={THEME_COLOR[prefs.skin][prefs.theme]} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: FIRST_FRAME_SCRIPT }} />
      </head>
      <body>
        <App avatars={avatarCatalog()} prefs={prefs} health={loadHealth()} serverNow={Date.now()}>
          {children}
        </App>
      </body>
    </html>
  );
}
