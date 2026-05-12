import { defineEventHandler, getQuery } from "h3";
import { withApi } from "~/server/lib/envelope";
import { readClaims } from "~/server/lib/current-user";
import { plazaList } from "~/server/services/plaza";
import type { PlazaFilter, PlazaSort } from "~/types";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await readClaims(event);
    const query = getQuery(event);
    const sort = (query.sort ?? "hot") as PlazaSort;
    const filter = (query.filter ?? "all") as PlazaFilter;
    const q = typeof query.q === "string" ? query.q : null;
    const page = Number(query.page ?? "1") || 1;
    const pageSize = Number(query.pageSize ?? "20") || 20;
    return plazaList({ sort, filter, q, page, pageSize, viewerId: claims?.id ?? null });
  }),
);
