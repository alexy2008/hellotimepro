import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { readClaims } from "@/lib/server/current-user";
import { getCapsuleByCode } from "@/services/capsules";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  return withApi(async () => {
    const { code } = await ctx.params;
    const claims = await readClaims(req);
    return getCapsuleByCode(code, claims?.id ?? null);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
