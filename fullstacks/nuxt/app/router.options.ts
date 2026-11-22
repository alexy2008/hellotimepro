import type { RouterConfig } from "@nuxt/schema";

export default {
  // 保留登录回跳参数中的百分号编码（X7）。
  stringifyQuery(query = {}) {
    return Object.entries(query).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).flatMap((part) => {
        if (part === undefined) return [];
        const name = encodeURIComponent(key);
        return part === null ? name : `${name}=${encodeURIComponent(String(part))}`;
      }),
    ).join("&");
  },
} satisfies RouterConfig;
