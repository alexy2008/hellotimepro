import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { loginSchema } from "@/lib/validation/schemas";
import { login } from "@/services/auth";
import { setSessionCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, loginSchema);
    const tokens = await login(body);
    // 附加 RSC 会话 cookie；Bearer 响应体不变（SPA / 契约不受影响）。
    await setSessionCookie(tokens.accessToken, tokens.accessTokenExpiresIn);
    return tokens;
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
