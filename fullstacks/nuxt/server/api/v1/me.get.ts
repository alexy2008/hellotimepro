import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { requireClaims } from "~/server/lib/current-user";
import { getMe } from "~/server/services/me";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    return getMe(claims.id);
  }),
);
