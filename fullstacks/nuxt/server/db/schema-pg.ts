/**
 * Drizzle PostgreSQL schema · 与 spec/db/schema.sql 结构等价
 *
 * - id / owner_id / user_id / capsule_id / family_id 用原生 UUID
 * - 时间列用 TIMESTAMPTZ；mode: "string" 让 Drizzle 在 JS 端以 ISO 字符串
 *   roundtrip，与 SQLite 端的 TEXT 列保持同形，服务代码无需做类型分支。
 * - 长度受限列用 VARCHAR(N) / CHAR(8)，命中 spec 的硬约束。
 * - CHECK 约束在迁移 SQL 里声明（Drizzle 0.30 的 check API 还不稳定）。
 */
import {
  boolean,
  char,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const tz = { withTimezone: true, mode: "string" } as const;

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: varchar("password_hash", { length: 100 }).notNull(),
    nickname: varchar("nickname", { length: 20 }).notNull(),
    avatarId: varchar("avatar_id", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => ({
    emailUk: uniqueIndex("users_email_uk").on(t.email),
    nicknameUk: uniqueIndex("users_nickname_uk").on(t.nickname),
  }),
);

export const capsules = pgTable(
  "capsules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: char("code", { length: 8 }).notNull(),
    title: varchar("title", { length: 60 }).notNull(),
    content: text("content").notNull(),
    openAt: timestamp("open_at", tz).notNull(),
    inPlaza: boolean("in_plaza").notNull().default(true),
    favoriteCount: integer("favorite_count").notNull().default(0),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => ({
    codeUk: uniqueIndex("capsules_code_uk").on(t.code),
    plazaHotIx: index("capsules_plaza_hot_ix").on(t.inPlaza, t.favoriteCount, t.createdAt),
    plazaNewIx: index("capsules_plaza_new_ix").on(t.inPlaza, t.createdAt),
    plazaOpenAtIx: index("capsules_plaza_open_at_ix").on(t.inPlaza, t.openAt),
    ownerCreatedIx: index("capsules_owner_created_ix").on(t.ownerId, t.createdAt),
  }),
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capsuleId: uuid("capsule_id")
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.capsuleId] }),
    userCreatedIx: index("favorites_user_created_ix").on(t.userId, t.createdAt),
    capsuleIx: index("favorites_capsule_ix").on(t.capsuleId),
  }),
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 100 }).notNull(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", tz),
  },
  (t) => ({
    hashUk: uniqueIndex("refresh_tokens_hash_uk").on(t.tokenHash),
    userIx: index("refresh_tokens_user_ix").on(t.userId),
    familyIx: index("refresh_tokens_family_ix").on(t.familyId),
    expiresIx: index("refresh_tokens_expires_ix").on(t.expiresAt),
  }),
);
