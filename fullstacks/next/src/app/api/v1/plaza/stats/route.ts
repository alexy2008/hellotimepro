import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { plazaStats } from "@/services/plaza";

/** GET /api/v1/plaza/stats?q= · 公开；counts 与列表同口径（受 q 影响），两个时刻不受 q 影响。 */
export async function GET(req: NextRequest) {
  return withApi(() => plazaStats(new URL(req.url).searchParams.get("q")));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
