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

const pgSchema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  nickname VARCHAR(20) NOT NULL,
  avatar_id VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT users_email_format_chk CHECK (email = lower(email) AND position('@' in email) > 1),
  CONSTRAINT users_nickname_length_chk CHECK (char_length(nickname) BETWEEN 2 AND 20)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname);

CREATE TABLE IF NOT EXISTS capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code CHAR(8) NOT NULL,
  title VARCHAR(60) NOT NULL,
  content TEXT NOT NULL,
  open_at TIMESTAMPTZ NOT NULL,
  in_plaza BOOLEAN NOT NULL DEFAULT TRUE,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT capsules_code_format_chk CHECK (code ~ '^[A-Z0-9]{8}$'),
  CONSTRAINT capsules_title_length_chk CHECK (char_length(title) BETWEEN 1 AND 60),
  CONSTRAINT capsules_content_length_chk CHECK (char_length(content) BETWEEN 1 AND 5000),
  CONSTRAINT capsules_open_after_create_chk CHECK (open_at > created_at + INTERVAL '60 seconds'),
  CONSTRAINT capsules_favorite_count_nonneg_chk CHECK (favorite_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk ON capsules (code);
CREATE INDEX IF NOT EXISTS capsules_plaza_hot_ix ON capsules (in_plaza, favorite_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS capsules_plaza_new_ix ON capsules (in_plaza, created_at DESC);
CREATE INDEX IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at);
CREATE INDEX IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  capsule_id UUID NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, capsule_id)
);
CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_capsule_ix ON favorites (capsule_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(100) NOT NULL,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uk ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_ix ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_ix ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_ix ON refresh_tokens (expires_at);
`;

const sqliteSchema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT users_email_format_chk CHECK (email = lower(email) AND instr(email, '@') > 1),
  CONSTRAINT users_nickname_length_chk CHECK (length(nickname) BETWEEN 2 AND 20)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname);

CREATE TABLE IF NOT EXISTS capsules (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (length(code) = 8),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  open_at TEXT NOT NULL,
  in_plaza INTEGER NOT NULL DEFAULT 1,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT capsules_title_length_chk CHECK (length(title) BETWEEN 1 AND 60),
  CONSTRAINT capsules_content_length_chk CHECK (length(content) BETWEEN 1 AND 5000),
  CONSTRAINT capsules_favorite_count_nonneg_chk CHECK (favorite_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk ON capsules (code);
CREATE INDEX IF NOT EXISTS capsules_plaza_hot_ix ON capsules (in_plaza, favorite_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS capsules_plaza_new_ix ON capsules (in_plaza, created_at DESC);
CREATE INDEX IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at);
CREATE INDEX IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  capsule_id TEXT NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, capsule_id)
);
CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_capsule_ix ON favorites (capsule_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  family_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uk ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_ix ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_ix ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_ix ON refresh_tokens (expires_at);
`;

// migrate() 不再由 main.ts 调用；schema 由仓库级 scripts/db 维护。
export async function migrate() {
  const h = await getHandle();
  if (h.kind === "postgres") {
    await h.pool.query(pgSchema);
  } else {
    h.sqlite.exec(sqliteSchema);
  }
}
