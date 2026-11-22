import { defineEventHandler, getQuery } from "h3";
import { withApi } from "~/server/lib/envelope";
import { readClaims } from "~/server/lib/current-user";
import { parsePlazaQuery } from "~/server/lib/query";
import { plazaList } from "~/server/services/plaza";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await readClaims(event);
    return plazaList({ ...parsePlazaQuery(getQuery(event)), viewerId: claims?.id ?? null });
  }),
);
