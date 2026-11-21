// ============================================================
// 根布局（Server Component）：<html>、首帧脚本、全局样式、头像表。
//
// - 样式原样引入 spec/styles（base → 时笺三件 → 琥珀三件 → shell），见 app/styles.css
// - 首帧之前由内联脚本从 localStorage 写好 data-skin / data-theme，避免闪出另一套
// - 头像在服务端读 spec/avatars/v2，作为 props 交给客户端根组件
// ============================================================
import "./styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClientRoot } from "@/components/ClientRoot";
import { avatarCatalog } from "@/lib/server/avatar-catalog";

export const metadata: Metadata = {
  title: "HelloTime Pro · 把此刻寄给未来",
  description: "写一段话，设定未来某一刻才能开启。",
  icons: { icon: { url: "/logo.svg", type: "image/svg+xml" } },
};

// 与 React 参考前端 index.html 的内联脚本一致（docs/02-design.md §9.3）
const FIRST_FRAME_SCRIPT = `(function () {
  var root = document.documentElement;
  try {
    var skin = localStorage.getItem("hellotime.skin");
    var theme = localStorage.getItem("hellotime.theme");
    if (skin !== "paper" && skin !== "amber") skin = "amber";
    if (theme !== "dark" && theme !== "light") {
      theme = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    root.setAttribute("data-skin", skin);
    root.setAttribute("data-theme", theme);
    var colors = { paper: { light: "#F3EFE5", dark: "#131210" }, amber: { light: "#faf5ea", dark: "#080b1a" } };
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", colors[skin][theme]);
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 内联脚本会在水合前改写 data-skin / data-theme，属性不一致是预期的
    <html lang="zh-CN" data-skin="amber" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080b1a" />
        <script dangerouslySetInnerHTML={{ __html: FIRST_FRAME_SCRIPT }} />
      </head>
      <body>
        <ClientRoot avatars={avatarCatalog()}>{children}</ClientRoot>
        <noscript>
          <p style={{ padding: 48 }}>请启用 JavaScript 后再访问。</p>
        </noscript>
      </body>
    </html>
  );
}
