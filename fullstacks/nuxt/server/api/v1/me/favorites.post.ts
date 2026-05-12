import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { requireClaims } from "~/server/lib/current-user";
import { favoriteSchema } from "~/lib/validation/schemas";
import { addFavorite } from "~/server/services/favorites";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const body = await parseJson(event, favoriteSchema);
    return addFavorite(claims.id, body.capsuleId);
  }),
);
