import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { logoutSchema } from "@/lib/validation/schemas";
import { logout } from "@/services/auth";
import { clearSessionCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    let refreshToken: string | undefined;
    try {
      const body = await parseJson(req, logoutSchema);
      refreshToken = body.refreshToken;
    } catch {
      refreshToken = undefined;
    }
    await logout(refreshToken);
    await clearSessionCookie();
    return null;
  }, { successStatus: 204, emptyBody: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
