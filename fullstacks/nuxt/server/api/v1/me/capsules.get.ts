import { defineEventHandler, getQuery } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parsePagination } from "~/server/lib/query";
import { requireClaims } from "~/server/lib/current-user";
import { myCapsules } from "~/server/services/plaza";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    return myCapsules({ userId: claims.id, ...parsePagination(getQuery(event)) });
  }),
);
