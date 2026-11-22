// /login · 登录（?redirect= 回跳）
import type { Metadata } from "next";
import { LoginPage } from "@/views/LoginPage";

export const metadata: Metadata = { title: "登录 · HelloTime Pro" };

export default function Page() {
  return <LoginPage />;
}
