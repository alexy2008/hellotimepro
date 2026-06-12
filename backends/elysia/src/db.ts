import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import pg from "pg";
import { env } from "./config";

type SqliteDb = Database;
type PgPool = pg.Pool;
type PgClient = pg.PoolClient;

export type DbHandle =
  | { kind: "sqlite"; sqlite: SqliteDb }
  | { kind: "postgres"; pool: PgPool };

let handle: DbHandle | null = null;

function parseSqlitePath(url: string): string {
  // sqlite:///relative/path  → relative/path
  // sqlite:////abs/path      → /abs/path
  // Strip exactly "sqlite:///" (10 chars) so the leading authority slash is consumed.
  // Using "sqlite://".length (9) would leave an extra "/" producing //abs/path.
  if (url.startsWith("sqlite:///")) return url.slice("sqlite:///".length);
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}

function pgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function getHandle(): Promise<DbHandle> {
  if (handle) return handle;
  if (env.dbDriver === "sqlite") {
    const path = parseSqlitePath(env.dbUrl);
    mkdirSync(dirname(path), { recursive: true });
    const sqlite = new Database(path);
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec("PRAGMA journal_mode = WAL");
    handle = { kind: "sqlite", sqlite };
    return handle;
  }
  const pool = new pg.Pool({ connectionString: env.dbUrl });
  handle = { kind: "postgres", pool };
  return handle;
}

export async function dbKind() {
  return (await getHandle()).kind;
}

async function queryOn(target: DbHandle | PgClient, sql: string, params: unknown[] = []) {
  if ("query" in target) {
    const res = await target.query(pgSql(sql), params);
    return res.rows;
  }
  if (target.kind === "postgres") {
    const res = await target.pool.query(pgSql(sql), params);
    return res.rows;
  }
  const trimmed = sql.trim().toLowerCase();
  const stmt = target.sqlite.query(sql);
  if (trimmed.startsWith("select") || trimmed.startsWith("with") || trimmed.startsWith("pragma")) {
    return stmt.all(...(params as never[]));
  }
  stmt.run(...(params as never[]));
  return [];
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await queryOn(await getHandle(), sql, params)) as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const h = await getHandle();
  if (h.kind === "postgres") {
    const client = await h.pool.connect();
    const tq = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      (await queryOn(client, sql, params)) as R[];
    try {
      await client.query("BEGIN");
      const result = await fn(tq as typeof query);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const tq = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await queryOn(h, sql, params)) as R[];
  h.sqlite.exec("BEGIN IMMEDIATE");
  try {
    const result = await fn(tq as typeof query);
    h.sqlite.exec("COMMIT");
    return result;
  } catch (e) {
    h.sqlite.exec("ROLLBACK");
    throw e;
  }
}
