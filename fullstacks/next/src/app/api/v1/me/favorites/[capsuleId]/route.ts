import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { requireClaims } from "@/lib/server/current-user";
import { removeFavorite } from "@/services/favorites";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ capsuleId: string }> },
) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const { capsuleId } = await ctx.params;
    await removeFavorite(claims.id, capsuleId);
    return null;
  }, { successStatus: 204, emptyBody: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
