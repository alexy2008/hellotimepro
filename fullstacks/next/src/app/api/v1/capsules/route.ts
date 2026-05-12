import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { requireClaims } from "@/lib/server/current-user";
import { createCapsuleSchema } from "@/lib/validation/schemas";
import { createCapsule } from "@/services/capsules";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const body = await parseJson(req, createCapsuleSchema);
    return createCapsule(claims.id, body);
  }, { successStatus: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
