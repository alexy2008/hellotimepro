import { defineEventHandler, getQuery } from "h3";
import { withApi } from "~/server/lib/envelope";
import { ERR } from "~/server/lib/errors";
import { getCapsuleRecommendations } from "~/server/services/recommendation";

// 公开端点（security: []）：推荐为锦上添花，匿名可访问。
export default defineEventHandler((event) =>
  withApi(event, async () => {
    const raw = getQuery(event).count;
    let count = 4;
    if (raw !== undefined) {
      const n = Number(Array.isArray(raw) ? raw[0] : raw);
      if (!Number.isInteger(n) || n < 3 || n > 8) {
        throw ERR.validation("count must be an integer in [3, 8]", "count");
      }
      count = n;
    }
    return getCapsuleRecommendations(count);
  }),
);
