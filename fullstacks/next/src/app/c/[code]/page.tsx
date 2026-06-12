// 胶囊详情 —— React Server Component：服务端按胶囊码取数（viewer 来自会话 cookie），
// 直接渲染。交互（收藏、复制、到点自动揭示）由客户端组件 CapsuleDetail 承担。
import type { Metadata } from "next";
import Link from "next/link";
import { getCapsuleByCode } from "@/services/capsules";
import { getServerViewer } from "@/lib/server/session";
import { Alert } from "@/components/alert";
import { CapsuleDetail } from "@/components/capsule-detail";
import { isApiError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// generateMetadata 与 page 共享同一次取数（Next 会自动去重）。
// 胶囊标题用于 <title> 与 og:title，方便分享链接展示正确卡片。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const viewer = await getServerViewer();
  try {
    const capsule = await getCapsuleByCode(code.toUpperCase(), viewer?.id ?? null);
    return {
      title: `${capsule.title} · HelloTime Pro`,
      description: capsule.isOpened
        ? `由 ${capsule.creator.nickname} 创建的时间胶囊`
        : `一封来自过去的信，尚未开启`,
    };
  } catch {
    return { title: "胶囊不存在 · HelloTime Pro" };
  }
}

export default async function CapsuleByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const viewer = await getServerViewer();

  let capsule = null;
  let errMsg: string | null = null;
  try {
    capsule = await getCapsuleByCode(code.toUpperCase(), viewer?.id ?? null);
  } catch (e) {
    errMsg = isApiError(e) ? e.message : "胶囊不存在";
  }

  return (
    <main className="cy-container">
      {capsule ? (
        <CapsuleDetail capsule={capsule} />
      ) : (
        <div style={{ maxWidth: 560, margin: "var(--space-12) auto" }}>
          <Alert variant="danger">{errMsg ?? "胶囊不存在"}</Alert>
          <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
            <Link className="cy-btn cy-btn--ghost" href="/open">
              返回输入码
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
