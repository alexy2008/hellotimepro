import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as pgSchema from "./schema-pg";
import * as sqliteSchema from "./schema-sqlite";

type PgDb = NodePgDatabase<typeof pgSchema>;
type SqliteDb = BetterSQLite3Database<typeof sqliteSchema>;
type Handle =
  | { kind: "postgres"; db: PgDb }
  | { kind: "sqlite"; db: SqliteDb; writer: SqliteDb; connection: Database.Database };

async function connect(): Promise<Handle> {
  if (process.env.DB_DRIVER?.toLowerCase() === "sqlite") {
    const { default: Database } = await import("better-sqlite3");
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const url = process.env.DB_URL || "file:../../data/sqlite/hellotime-nuxt.db";
    const path = url.replace(/^(sqlite:\/\/\/|file:)/, "");
    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    // SQLite 内置 lower 只覆盖 ASCII。Unicode 标题、昵称也走同一条匹配规则。
    sqlite.function("lower", { deterministic: true }, (text: string) => text.toLowerCase());
    const connection = path === ":memory:" ? sqlite : new Database(path);
    connection.pragma("foreign_keys = ON");
    return {
      kind: "sqlite",
      db: drizzle(sqlite, { schema: sqliteSchema }),
      writer: drizzle(connection, { schema: sqliteSchema }),
      connection,
    };
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const url = process.env.DB_URL || "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro";
  const pool = new Pool({ connectionString: url.replace(/^postgresql\+psycopg:/, "postgresql:") });
  return { kind: "postgres", db: drizzle(pool, { schema: pgSchema }) };
}

let handle: Promise<Handle> | undefined;
const getHandle = () => (handle ??= connect());

export type DbContext = {
  db: PgDb;
  t: typeof pgSchema;
  kind: Handle["kind"];
};

// 两份 schema 的 JS 字段同形，业务查询只用两种 Drizzle builder 共有的操作。
// 锁行等方言专有操作先判断 kind；类型转换集中在连接边界。
function sqliteContext(db: SqliteDb): DbContext {
  return {
    db: db as unknown as PgDb,
    t: sqliteSchema as unknown as typeof pgSchema,
    kind: "sqlite",
  };
}

export async function getCtx(): Promise<DbContext> {
  const h = await getHandle();
  return h.kind === "sqlite" ? sqliteContext(h.db) : { db: h.db, t: pgSchema, kind: h.kind };
}

let writeTail: Promise<void> = Promise.resolve();

/**
 * 胶囊写入事务。PostgreSQL 使用 Drizzle 事务和胶囊行锁。
 * SQLite 单独使用写连接串行执行，读查询不会加入正在进行的事务。
 * SQLite 回调中仅执行本地 SQL，不等待网络或其他外部 I/O。
 */
export async function withCapsuleTransaction<T>(operation: (ctx: DbContext) => Promise<T>): Promise<T> {
  const h = await getHandle();
  if (h.kind === "postgres") {
    return h.db.transaction((db) => operation({ db, t: pgSchema, kind: "postgres" }));
  }

  const write = writeTail.then(async () => {
    h.connection.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation(sqliteContext(h.writer));
      h.connection.exec("COMMIT");
      return result;
    } catch (error) {
      if (h.connection.inTransaction) h.connection.exec("ROLLBACK");
      throw error;
    }
  });
  writeTail = write.then(() => undefined, () => undefined);
  return write;
}
