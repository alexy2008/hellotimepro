import "./globals.css";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: "HelloTime Pro · Next.js 全栈",
  description: "多技术栈对比学习项目 — 写一封信给未来的自己。",
};

const THEME_INIT_SCRIPT = `(function () {
  try {
    var raw = localStorage.getItem("hellotime-pro-theme");
    if (!raw) return;
    var t = JSON.parse(raw).state.theme;
    if (t === "dark" || t === "light") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 提早注入主题，避免首屏闪白；zustand persist 落盘是 JSON，先解出 state.theme 再写 data-theme */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
