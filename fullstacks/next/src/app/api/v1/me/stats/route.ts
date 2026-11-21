import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { requireClaims } from "@/lib/server/current-user";
import { myStats } from "@/services/plaza";

/** GET /api/v1/me/stats · 需登录；含未公开的胶囊。 */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    return myStats(claims.id);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
