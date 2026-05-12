import { defineEventHandler, getRouterParam } from "h3";
import { withApi } from "~/server/lib/envelope";
import { requireClaims } from "~/server/lib/current-user";
import { removeFavorite } from "~/server/services/favorites";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const capsuleId = getRouterParam(event, "capsuleId") ?? "";
    await removeFavorite(claims.id, capsuleId);
    return null;
  }, { successStatus: 204, emptyBody: true }),
);
