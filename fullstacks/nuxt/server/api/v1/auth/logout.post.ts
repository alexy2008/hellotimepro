import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { logoutSchema } from "~/lib/validation/schemas";
import { logout } from "~/server/services/auth";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    let refreshToken: string | undefined;
    try {
      const body = await parseJson(event, logoutSchema);
      refreshToken = body.refreshToken;
    } catch {
      refreshToken = undefined;
    }
    await logout(refreshToken);
    return null;
  }, { successStatus: 204, emptyBody: true }),
);
