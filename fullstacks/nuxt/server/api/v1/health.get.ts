import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { env } from "~/server/lib/env";
import type { HealthData, StackItem } from "~/types";

const STARTED_AT = Date.now();

function buildStack(): { kind: "fullstack"; summary: string; items: StackItem[] } {
  const isSqlite = env.dbDriver === "sqlite";
  const dbName = isSqlite ? "SQLite" : "PostgreSQL";
  const dbVer = isSqlite ? "3" : "16";
  const dbIcon = isSqlite ? "sqlite" : "postgresql";
  const dbTagline = isSqlite
    ? "零配置嵌入式关系型数据库，适合本地开发与测试"
    : "功能丰富的开源关系型数据库，号称「最先进的开源数据库」";
  const dbFeatures = isSqlite
    ? [
        "DB_DRIVER=sqlite 一键切换，无需部署独立数据库服务",
        "Drizzle ORM 抽象层使同一领域代码在 SQLite / PostgreSQL 间无缝切换",
        "WAL 模式 + foreign_keys=ON，满足本地开发与 CI 验证场景",
      ]
    : [
        "ACID 事务保障 favorite_count 反规范化计数的写入一致性",
        "refresh_tokens 表以 family_id + revoked_at 实现令牌族追踪，防重放攻击",
        "DB_DRIVER 环境变量热切换 SQLite/PostgreSQL，无需修改业务代码",
      ];

  const summary =
    "基于 Nuxt 3 + Nitro + TypeScript 全栈实现，" +
    "server/api 提供 /api/v1/* REST 接口，" +
    "选用 Drizzle ORM 作为双数据库抽象层，bcryptjs + jose 实现 JWT 双令牌鉴权，" +
    "Zod 校验请求体，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。" +
    "Nitro 服务端引擎将文件路由直接映射为 RESTful 端点，" +
    "server 目录的代码天然隔离于客户端 bundle 之外，无需额外的编译标记即可保证敏感逻辑安全。" +
    "Drizzle ORM 通过动态导入技术在服务端根据环境变量无缝适配 PostgreSQL 和 SQLite 驱动，" +
    "同一份业务代码在不同数据库方言下无感运行。" +
    "Refresh Token 家族轮转与重放检测提供严密的身份安全防范。" +
    "前后端共享同一仓库、同一类型定义，构建产物为单一可执行 Node 应用。";

  const items: StackItem[] = [
    {
      role: "language",
      name: "TypeScript",
      version: "5",
      iconUrl: "/static/icons/typescript.svg",
      tagline: "JavaScript 的静态类型超集，前后端类型直通",
      features: [
        "前后端共享 types 类型定义，避免接口字段不一致",
        "Zod schema 同时承担运行时校验与类型推导",
        "严格 TS 模式 + Drizzle 类型化 ORM",
      ],
    },
    {
      role: "framework",
      name: "Nuxt",
      version: "3",
      iconUrl: "/static/icons/nuxt.svg",
      tagline: "Vue 全栈框架，Nitro server/api 与文件路由约定",
      features: [
        "server/api 文件路由直接映射 /api/v1/* RESTful 端点",
        "Nuxt pages/layouts 承载前端路由与账号区布局",
        "Nitro Node preset 运行数据库、JWT 与 LLM fallback 等服务端逻辑",
      ],
    },
    {
      role: "database",
      name: dbName,
      version: dbVer,
      iconUrl: `/static/icons/${dbIcon}.svg`,
      tagline: dbTagline,
      features: dbFeatures,
    },
  ];
  return { kind: "fullstack", summary, items };
}

export default defineEventHandler((event) =>
  withApi<HealthData>(event, () => ({
    status: "ok",
    service: env.serviceName,
    version: env.serviceVersion,
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    stack: buildStack(),
  })),
);
