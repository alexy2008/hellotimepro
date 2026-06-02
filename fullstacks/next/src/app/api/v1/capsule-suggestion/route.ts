import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { capsuleSuggestionSchema } from "@/lib/validation/schemas";
import { suggestCapsule } from "@/services/suggestion";

// 公开端点（security: []）：匿名用户也能在创建前获取 AI 胶囊建议。
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, capsuleSuggestionSchema);
    return suggestCapsule(body);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
