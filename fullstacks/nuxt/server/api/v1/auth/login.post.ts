import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { loginSchema } from "~/lib/validation/schemas";
import { login } from "~/server/services/auth";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const body = await parseJson(event, loginSchema);
    return login(body);
  }),
);
