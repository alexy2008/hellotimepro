import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { refreshSchema } from "@/lib/validation/schemas";
import { refresh } from "@/services/auth";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, refreshSchema);
    return refresh(body.refreshToken);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
