import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { registerSchema } from "@/lib/validation/schemas";
import { register } from "@/services/auth";
import { setSessionCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, registerSchema);
    const tokens = await register(body);
    await setSessionCookie(tokens.accessToken, tokens.accessTokenExpiresIn);
    return tokens;
  }, { successStatus: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
