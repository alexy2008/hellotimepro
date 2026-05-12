/**
 * 双驱动连接切换器
 *
 * - DB_DRIVER=postgres：node-postgres + Drizzle
 * - DB_DRIVER=sqlite  ：better-sqlite3 + Drizzle
 *
 * 服务代码引用 `db` 与 `tables`，两套 schema 已设计为同形（TEXT/INTEGER/BOOLEAN），
 * 大多数 Drizzle 查询 API 在两端通用。差异点（如 `count(*)` 的 PG `BIGINT` 返回 string）
 * 在调用处显式 Number 化。
 */
import "server-only";

import * as pgSchema from "./schema-pg";
import * as sqliteSchema from "./schema-sqlite";

type Handle =
  | {
      kind: "postgres";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      drizzle: any;
      tables: typeof pgSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw: any;
    }
  | {
      kind: "sqlite";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      drizzle: any;
      tables: typeof sqliteSchema;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw: any;
    };

declare global {
  // eslint-disable-next-line no-var
  var __helloTimeDb: Handle | undefined;
}

async function build(): Promise<Handle> {
  const driver = (process.env.DB_DRIVER ?? "postgres").toLowerCase();
  if (driver === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const url = process.env.DB_URL ?? "file:../../data/sqlite/hellotime.db";
    let path = url;
    if (path.startsWith("sqlite:///")) path = path.slice(10);
    else if (path.startsWith("file:")) path = path.slice(5);
    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    return {
      kind: "sqlite",
      drizzle: drizzle(sqlite, { schema: sqliteSchema }),
      tables: sqliteSchema,
      raw: sqlite,
    };
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const url =
    process.env.DB_URL ?? "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro";
  const pool = new Pool({ connectionString: url });
  return {
    kind: "postgres",
    drizzle: drizzle(pool, { schema: pgSchema }),
    tables: pgSchema,
    raw: pool,
  };
}

let handlePromise: Promise<Handle> | null = null;
function getHandle(): Promise<Handle> {
  if (globalThis.__helloTimeDb) return Promise.resolve(globalThis.__helloTimeDb);
  if (!handlePromise) {
    handlePromise = build().then((h) => {
      globalThis.__helloTimeDb = h;
      return h;
    });
  }
  return handlePromise;
}

export async function getDb() {
  return (await getHandle()).drizzle as ReturnType<
    typeof import("drizzle-orm/node-postgres").drizzle<typeof pgSchema>
  >;
}

export async function getTables() {
  return (await getHandle()).tables as typeof pgSchema;
}

export async function getDbKind() {
  return (await getHandle()).kind;
}

/** 同时返回 db 和 tables，便于在 service 中一次解构。 */
export async function getCtx() {
  const h = await getHandle();
  return {
    db: h.drizzle as ReturnType<
      typeof import("drizzle-orm/node-postgres").drizzle<typeof pgSchema>
    >,
    t: h.tables as typeof pgSchema,
    kind: h.kind,
  };
}
