// /capsules/:code · 胶囊详情（Server Component）
// 服务端按码取胶囊（匿名），生成页面标题与描述，并把数据交给客户端视图作为第一屏；
// generateMetadata 与页面共用 loadCapsuleSeed（React cache），同一次请求只查一次库。
import type { Metadata } from "next";
import { CapsuleByCodePage } from "@/views/CapsuleByCodePage";
import { dateFormat, SSR_TIME_ZONE } from "@/lib/fmt";
import { loadCapsuleSeed } from "@/lib/server/page-data";

type Props = { params: Promise<{ code: string }> };

const SITE = "HelloTime Pro";

/** 正文摘要：压成一行，最多 80 个字（按码点截） */
function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length > 80 ? chars.slice(0, 80).join("") + "…" : flat;
}

// 搜索摘要使用与服务端详情相同的日历日。
const serverDate = dateFormat(SSR_TIME_ZONE);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const seed = await loadCapsuleSeed(code);
  if (seed?.status === "ok") {
    const c = seed.capsule;
    const title = `${c.title} · ${SITE}`;
    // 未开启的胶囊不泄露正文：只说谁封存的、哪天开启
    const description =
      c.isOpened && c.content
        ? excerpt(c.content)
        : `${c.creator.nickname} 封存的一枚时间胶囊，将在 ${serverDate.cn(Date.parse(c.openAt))} 开启。`;
    return { title, description, openGraph: { title, description, type: "article" } };
  }
  if (seed?.status === "missing") {
    return { title: `找不到这枚胶囊 · ${SITE}`, description: `没有胶囊码为 ${code.toUpperCase()} 的胶囊。` };
  }
  return { title: `胶囊详情 · ${SITE}` };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  return <CapsuleByCodePage initial={await loadCapsuleSeed(code)} />;
}
