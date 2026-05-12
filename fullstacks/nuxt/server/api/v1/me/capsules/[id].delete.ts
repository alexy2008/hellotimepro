import { defineEventHandler, getRouterParam } from "h3";
import { withApi } from "~/server/lib/envelope";
import { requireClaims } from "~/server/lib/current-user";
import { deleteOwnCapsule } from "~/server/services/capsules";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const id = getRouterParam(event, "id") ?? "";
    await deleteOwnCapsule(claims.id, id);
    return null;
  }, { successStatus: 204, emptyBody: true }),
);
