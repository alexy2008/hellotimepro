import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { refreshSchema } from "~/lib/validation/schemas";
import { refresh } from "~/server/services/auth";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const body = await parseJson(event, refreshSchema);
    return refresh(body.refreshToken);
  }),
);
