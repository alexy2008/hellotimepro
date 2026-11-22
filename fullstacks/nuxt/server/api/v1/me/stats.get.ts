import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { requireClaims } from "~/server/lib/current-user";
import { myStats } from "~/server/services/plaza";

export default defineEventHandler((event) =>
  withApi(event, async () => myStats((await requireClaims(event)).id)),
);
