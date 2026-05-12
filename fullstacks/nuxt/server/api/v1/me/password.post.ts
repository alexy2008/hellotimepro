import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { requireClaims } from "~/server/lib/current-user";
import { changePasswordSchema } from "~/lib/validation/schemas";
import { changePassword } from "~/server/services/auth";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const body = await parseJson(event, changePasswordSchema);
    await changePassword(claims.id, body.currentPassword, body.newPassword);
    return null;
  }, { successStatus: 204, emptyBody: true }),
);
