import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { requireClaims } from "@/lib/server/current-user";
import { updateProfileSchema } from "@/lib/validation/schemas";
import { getMe, updateProfile } from "@/services/me";

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    return getMe(claims.id);
  });
}

export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const body = await parseJson(req, updateProfileSchema);
    return updateProfile(claims.id, body);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
