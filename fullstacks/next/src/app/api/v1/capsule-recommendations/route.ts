import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { ERR } from "@/lib/server/errors";
import { getCapsuleRecommendations } from "@/services/recommendation";

// 公开端点（security: []）：推荐为锦上添花，匿名可访问。
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const raw = new URL(req.url).searchParams.get("count");
    let count = 4;
    if (raw !== null) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 3 || n > 8) {
        throw ERR.validation("count must be an integer in [3, 8]", "count");
      }
      count = n;
    }
    return getCapsuleRecommendations(count);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
