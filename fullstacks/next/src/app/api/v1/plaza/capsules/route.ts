import type { NextRequest } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { readClaims } from "@/lib/server/current-user";
import { plazaList } from "@/services/plaza";
import type { PlazaFilter, PlazaSort } from "@/types";

export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await readClaims(req);
    const u = new URL(req.url);
    const sort = (u.searchParams.get("sort") ?? "hot") as PlazaSort;
    const filter = (u.searchParams.get("filter") ?? "all") as PlazaFilter;
    const q = u.searchParams.get("q");
    const page = Number(u.searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20") || 20;
    return plazaList({ sort, filter, q, page, pageSize, viewerId: claims?.id ?? null });
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
