// /about · 关于（Server Component）
// /health 的技术栈在服务端直接取（同进程调 services，不发 HTTP），交给客户端视图渲染。
import type { Metadata } from "next";
import { AboutPage } from "@/views/AboutPage";
import { loadHealth } from "@/lib/server/page-data";

export const metadata: Metadata = { title: "关于 · HelloTime Pro" };

export default async function Page() {
  return <AboutPage health={loadHealth()} />;
}
