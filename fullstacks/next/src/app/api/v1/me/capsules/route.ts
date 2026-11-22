import type { NextRequest } from "next/server";
import { parsePagination } from "@/lib/server/pagination";
import { withApi } from "@/lib/server/envelope";
import { requireClaims } from "@/lib/server/current-user";
import { myCapsules } from "@/services/plaza";

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    const u = new URL(req.url);
    const { page, pageSize } = parsePagination(u.searchParams);
    return myCapsules({ userId: claims.id, page, pageSize });
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
