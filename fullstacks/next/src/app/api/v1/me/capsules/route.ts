import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { requireClaims } from "@/lib/server/current-user";
import { myCapsules } from "@/services/plaza";

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const u = new URL(req.url);
    const page = Number(u.searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20") || 20;
    return myCapsules({ userId: claims.id, page, pageSize });
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
