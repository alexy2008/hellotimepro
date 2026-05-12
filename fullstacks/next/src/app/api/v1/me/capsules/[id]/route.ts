import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { requireClaims } from "@/lib/server/current-user";
import { deleteOwnCapsule } from "@/services/capsules";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const { id } = await ctx.params;
    await deleteOwnCapsule(claims.id, id);
    return null;
  }, { successStatus: 204, emptyBody: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
