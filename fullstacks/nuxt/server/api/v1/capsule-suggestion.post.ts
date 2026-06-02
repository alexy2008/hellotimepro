import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { parseJson } from "~/server/lib/parse-body";
import { capsuleSuggestionSchema } from "~/lib/validation/schemas";
import { suggestCapsule } from "~/server/services/suggestion";

// 公开端点（security: []）：匿名用户也能在创建前获取 AI 胶囊建议。
export default defineEventHandler((event) =>
  withApi(event, async () => {
    const body = await parseJson(event, capsuleSuggestionSchema);
    return suggestCapsule(body);
  }),
);
