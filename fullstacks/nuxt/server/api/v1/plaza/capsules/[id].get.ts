import { defineEventHandler, getRouterParam } from "h3";
import { withApi } from "~/server/lib/envelope";
import { readClaims } from "~/server/lib/current-user";
import { getPlazaDetail } from "~/server/services/capsules";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await readClaims(event);
    return getPlazaDetail(getRouterParam(event, "id") ?? "", claims?.id ?? null);
  }),
);
