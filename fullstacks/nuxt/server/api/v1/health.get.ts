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
      summary: "Nitro 通过文件路由提供 REST 接口，H3 与 Zod 负责解析和校验请求。Drizzle 管理 PostgreSQL 与 SQLite 查询及事务，jose 与 bcryptjs 提供 JWT 认证和密码校验。",
      items: [
        { role: "language", name: "TypeScript", version: "5", iconUrl: "/static/icons/typescript.svg" },
        { role: "framework", name: "Nitro", version: "2", iconUrl: "/static/icons/nuxt.svg" },
        { role: "orm", name: "Drizzle ORM", version: "0.38" },
        env.dbDriver === "sqlite"
          ? { role: "database", name: "SQLite", version: "3", iconUrl: "/static/icons/sqlite.svg" }
          : { role: "database", name: "PostgreSQL", version: "16", iconUrl: "/static/icons/postgresql.svg" },
      ],
    },
  })),
);
