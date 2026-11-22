import { defineEventHandler, getQuery } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseSearch } from "~/server/lib/query";
import { plazaStats } from "~/server/services/plaza";

export default defineEventHandler((event) =>
  withApi(event, () => plazaStats(parseSearch(getQuery(event)))),
);
