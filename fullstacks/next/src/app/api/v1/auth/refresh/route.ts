import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { refreshSchema } from "@/lib/validation/schemas";
import { refresh } from "@/services/auth";
import { setSessionCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, refreshSchema);
    const tokens = await refresh(body.refreshToken);
    // 刷新后续期 RSC 会话 cookie。
    await setSessionCookie(tokens.accessToken, tokens.accessTokenExpiresIn);
    return tokens;
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
