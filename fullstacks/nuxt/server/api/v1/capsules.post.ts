import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { requireClaims } from "~/server/lib/current-user";
import { createCapsuleSchema } from "~/lib/validation/schemas";
import { createCapsule } from "~/server/services/capsules";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = await requireClaims(event);
    const body = await parseJson(event, createCapsuleSchema);
    return createCapsule(claims.id, body);
  }, { successStatus: 201 }),
);
