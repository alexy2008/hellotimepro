import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { loginSchema } from "@/lib/validation/schemas";
import { login } from "@/services/auth";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, loginSchema);
    return login(body);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
