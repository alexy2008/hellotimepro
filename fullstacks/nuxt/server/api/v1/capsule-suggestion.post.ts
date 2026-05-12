import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { requireClaims } from "~/server/lib/current-user";
import { capsuleSuggestionSchema } from "~/lib/validation/schemas";
import { suggestCapsule } from "~/server/services/suggestion";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    await requireClaims(event);
    const body = await parseJson(event, capsuleSuggestionSchema);
    return suggestCapsule(body);
  }),
);
