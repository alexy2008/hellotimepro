import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { env } from "~/server/lib/env";
import type { HealthData } from "~/types";

const startedAt = Date.now();

export default defineEventHandler((event) =>
  withApi<HealthData>(event, () => ({
    status: "ok",
    service: "hellotime-pro",
    version: "2.0.0",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    stack: {
      kind: "fullstack",
      summary:
        "基于 Nuxt 内置的 Nitro 2 引擎与 TypeScript 5.7 实现同源服务端，通过 server/api/v1 文件路由提供完整 REST 契约，" +
        "由 H3 处理请求上下文并统一封装响应外壳与错误码，Zod 负责严格入参校验。" +
        "认证层采用 jose 与 bcryptjs 实现 HS256 JWT 签发及 Refresh Token 家族轮换与重放检测。" +
        "持久层通过 Drizzle ORM 管理双库表定义、查询与事务，可按环境变量在 PostgreSQL 与 SQLite 间无缝切换。",
      items: [
        { role: "language", name: "TypeScript", version: "5.7", iconUrl: "/static/icons/typescript.svg" },
        { role: "framework", name: "Nitro", version: "2", iconUrl: "/static/icons/nuxt.svg" },
        { role: "orm", name: "Drizzle ORM", version: "0.38" },
        env.dbDriver === "sqlite"
          ? { role: "database", name: "SQLite", version: "3", iconUrl: "/static/icons/sqlite.svg" }
          : { role: "database", name: "PostgreSQL", version: "16", iconUrl: "/static/icons/postgresql.svg" },
      ],
    },
  })),
);
