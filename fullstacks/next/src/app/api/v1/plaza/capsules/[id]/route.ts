import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { readClaims } from "@/lib/server/current-user";
import { getPlazaCapsuleById } from "@/services/capsules";
import type { CapsuleDetail } from "@/types";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return withApi<CapsuleDetail>(async () => {
    const { id } = await ctx.params;
    const claims = await readClaims(req);
    return getPlazaCapsuleById(id, claims?.id ?? null);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
