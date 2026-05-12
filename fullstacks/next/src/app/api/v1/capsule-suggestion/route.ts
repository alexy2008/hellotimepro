import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { requireClaims } from "@/lib/server/current-user";
import { capsuleSuggestionSchema } from "@/lib/validation/schemas";
import { suggestCapsule } from "@/services/suggestion";

export async function POST(req: NextRequest) {
  return withApi(async () => {
    await requireClaims(req);
    const body = await parseJson(req, capsuleSuggestionSchema);
    return suggestCapsule(body);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
