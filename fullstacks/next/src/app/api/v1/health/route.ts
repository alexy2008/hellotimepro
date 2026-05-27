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

  const summary =
    "基于 Next.js App Router + TypeScript 全栈实现，" +
    "Route Handlers 提供 /api/v1/* REST 接口，" +
    "选用 Drizzle ORM 作为双数据库抽象层，bcryptjs + jose 实现 JWT 双令牌鉴权，" +
    "Zod 校验请求体，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。" +
    "利用文件系统路由将页面与 API 端点统一组织，前后端共享 TypeScript 类型与 Zod Schema。" +
    "Drizzle ORM 通过动态导入技术无缝适配 PostgreSQL 和 SQLite 双数据库引擎，" +
    "其 TypeScript 即 SQL 的设计理念确保了从 Schema 到查询的全链路类型安全。" +
    "server-only 编译期防火墙保证数据库连接、JWT 密钥等绝不会被打进浏览器 bundle。" +
    "Refresh Token 家族轮转与重放检测提供金融级的身份安全防范。" +
    "前后端共享同一仓库、同一类型定义、同一构建产物。";

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
