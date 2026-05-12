import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { registerSchema } from "~/lib/validation/schemas";
import { register } from "~/server/services/auth";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const body = await parseJson(event, registerSchema);
    return register(body);
  }, { successStatus: 201 }),
);
