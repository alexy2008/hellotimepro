import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/envelope";
import { env } from "@/lib/env";
import type { HealthData, StackItem } from "@/types";

const STARTED_AT = Date.now();

function buildStack(): { kind: "fullstack"; summary: string; items: StackItem[] } {
  const isSqlite = env.dbDriver === "sqlite";
  const dbName = isSqlite ? "SQLite" : "PostgreSQL";
  const dbVer = isSqlite ? "3" : "16";
  const dbIcon = isSqlite ? "sqlite" : "postgresql";

  const summary = isSqlite
    ? "基于 Next.js 15 App Router + TypeScript 全栈实现，Route Handlers 提供 /api/v1/* REST 接口，Drizzle ORM 同一份查询代码同时驱动 SQLite / PostgreSQL，bcryptjs + jose 实现 JWT 双令牌鉴权，Zod 校验请求体，适合本地开发与 CI 验证。"
    : "基于 Next.js 15 App Router + TypeScript 全栈实现，Route Handlers 提供 /api/v1/* REST 接口，Drizzle ORM + node-postgres 承载业务数据，bcryptjs + jose 实现 JWT 双令牌鉴权，Zod 校验请求体，refresh token 族追踪防重放，前后端共享同一仓库与类型定义。";

  const items: StackItem[] = [
    { role: "language", name: "TypeScript", version: "5", iconUrl: "/static/icons/typescript.svg" },
    { role: "framework", name: "Next.js", version: "15", iconUrl: "/static/icons/nextjs.svg" },
    { role: "database", name: dbName, version: dbVer, iconUrl: `/static/icons/${dbIcon}.svg` },
  ];
  return { kind: "fullstack", summary, items };
}

export async function GET() {
  return withApi<HealthData>(() => ({
    status: "ok",
    service: env.serviceName,
    version: env.serviceVersion,
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    stack: buildStack(),
  }));
}

// 显式声明运行时（spec 要 Node API：fs 读 catalog 等）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
