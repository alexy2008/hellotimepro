import "./globals.css";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: "HelloTime Pro · Next.js 全栈",
  description: "多技术栈对比学习项目 — 写一封信给未来的自己。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
