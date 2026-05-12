import { defineEventHandler, getRouterParam } from "h3";
import { withApi } from "~/server/lib/envelope";
import { readClaims } from "~/server/lib/current-user";
import { getCapsuleByCode } from "~/server/services/capsules";

export default defineEventHandler((event) =>
  withApi(event, async () => {
    const code = getRouterParam(event, "code") ?? "";
    const claims = await readClaims(event);
    return getCapsuleByCode(code, claims?.id ?? null);
  }),
);
