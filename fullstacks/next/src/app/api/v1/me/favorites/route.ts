import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { parseJson } from "@/lib/server/parse-body";
import { requireClaims } from "@/lib/server/current-user";
import { favoriteSchema } from "@/lib/validation/schemas";
import { addFavorite } from "@/services/favorites";
import { myFavorites } from "@/services/plaza";

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const u = new URL(req.url);
    const page = Number(u.searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20") || 20;
    return myFavorites({ userId: claims.id, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const body = await parseJson(req, favoriteSchema);
    return addFavorite(claims.id, body.capsuleId);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
