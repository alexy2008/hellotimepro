import { defineEventHandler, getQuery } from "h3";
import { withApi } from "~/server/lib/envelope";
import { requireClaims } from "~/server/lib/current-user";
import { myCapsules } from "~/server/services/plaza";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const query = getQuery(event);
    const page = Number(query.page ?? "1") || 1;
    const pageSize = Number(query.pageSize ?? "20") || 20;
    return myCapsules({ userId: claims.id, page, pageSize });
  }),
);
