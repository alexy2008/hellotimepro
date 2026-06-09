// 胶囊详情 —— React Server Component：服务端按胶囊码取数（viewer 来自会话 cookie），
// 直接渲染。交互（收藏、复制、到点自动揭示）由客户端组件 CapsuleDetail 承担。
import Link from "next/link";
import { getCapsuleByCode } from "@/services/capsules";
import { getServerViewer } from "@/lib/server/session";
import { Alert } from "@/components/alert";
import { CapsuleDetail } from "@/components/capsule-detail";
import { isApiError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
