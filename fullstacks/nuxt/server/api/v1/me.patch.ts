import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { requireClaims } from "~/server/lib/current-user";
import { updateProfileSchema } from "~/lib/validation/schemas";
import { updateProfile } from "~/server/services/me";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const body = await parseJson(event, updateProfileSchema);
    return updateProfile(claims.id, body);
  }),
);
