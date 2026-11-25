import "server-only";

// ============================================================
// /health 的数据：接口（app/api/v1/health/route.ts）与关于页、页脚的服务端渲染共用。
// ============================================================
import { env } from "@/lib/env";
import type { HealthData, StackItem } from "@/types";

const STARTED_AT = Date.now();

function buildStack(): { kind: "fullstack"; summary: string; items: StackItem[] } {
  const isSqlite = env.dbDriver === "sqlite";
  const dbName = isSqlite ? "SQLite" : "PostgreSQL";
  const dbVer = isSqlite ? "3" : "16";
  const dbIcon = isSqlite ? "sqlite" : "postgresql";

  const summary =
    "基于 Next.js 15 Route Handlers 与 TypeScript 5.7 实现同源服务端，" +
    "在同一进程内对外提供完整的 /api/v1/* REST 接口，并与页面共享类型定义与 Zod 请求校验 Schema。" +
    "认证层采用 jose 与 bcryptjs 实现 HS256 JWT 及 Refresh Token 家族轮换与重放检测，" +
    "server-only 编译期边界确保密钥与数据库连接不会进入浏览器产物。" +
    "持久层选用 Drizzle ORM，通过驱动分支同时支持 PostgreSQL 与 SQLite 双库及事务一致性维护。";

  const items: StackItem[] = [
    { role: "language", name: "TypeScript", version: "5.7", iconUrl: "/static/icons/typescript.svg" },
    { role: "framework", name: "Next.js", version: "15", iconUrl: "/static/icons/nextjs.svg" },
    { role: "orm", name: "Drizzle ORM", version: "0.38", iconUrl: null },
    { role: "database", name: dbName, version: dbVer, iconUrl: `/static/icons/${dbIcon}.svg` },
  ];
  return { kind: "fullstack", summary, items };
}

export function getHealth(): HealthData {
  return {
    status: "ok",
    service: env.serviceName,
    version: env.serviceVersion,
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    stack: buildStack(),
  };
}
