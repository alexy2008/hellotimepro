// / · 首页即胶囊广场（Server Component）
// 服务端直接调 services 取第一屏（匿名），交给客户端视图；之后的翻页、筛选、搜索、收藏走 /api/v1。
import type { Metadata } from "next";
import { PlazaPage } from "@/views/PlazaPage";
import { loadPlazaSeed } from "@/lib/server/page-data";

export const metadata: Metadata = { title: "把此刻寄给未来 · HelloTime Pro" };

export default async function Page() {
  return <PlazaPage initial={await loadPlazaSeed()} />;
}
