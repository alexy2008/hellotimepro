import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { requireClaims } from "@/lib/server/current-user";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { changePassword } from "@/services/auth";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const body = await parseJson(req, changePasswordSchema);
    await changePassword(claims.id, body.currentPassword, body.newPassword);
    return null;
  }, { successStatus: 204, emptyBody: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
