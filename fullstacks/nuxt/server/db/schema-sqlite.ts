/**
 * Drizzle SQLite schema · 与 spec/db/schema.sql 等价（方言差异：UUID/TIMESTAMPTZ → TEXT）
 *
 * - UUID 用 TEXT (length 36) 存
 * - TIMESTAMPTZ 用 TEXT (ISO 8601 UTC) 存
 * - now() 由应用层填充
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    nickname: text("nickname").notNull(),
    avatarId: text("avatar_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    emailUk: uniqueIndex("users_email_uk").on(t.email),
    nicknameUk: uniqueIndex("users_nickname_uk").on(t.nickname),
  }),
);

export const capsules = sqliteTable(
  "capsules",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    openAt: text("open_at").notNull(),
    inPlaza: integer("in_plaza", { mode: "boolean" }).notNull().default(true),
    favoriteCount: integer("favorite_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    codeUk: uniqueIndex("capsules_code_uk").on(t.code),
    plazaHotIx: index("capsules_plaza_hot_ix").on(t.inPlaza, t.favoriteCount, t.createdAt),
    plazaNewIx: index("capsules_plaza_new_ix").on(t.inPlaza, t.createdAt),
    ownerCreatedIx: index("capsules_owner_created_ix").on(t.ownerId, t.createdAt),
  }),
);

export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capsuleId: text("capsule_id")
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.capsuleId] }),
    userCreatedIx: index("favorites_user_created_ix").on(t.userId, t.createdAt),
  }),
);

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: text("family_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => ({
    hashUk: uniqueIndex("refresh_tokens_hash_uk").on(t.tokenHash),
    userIx: index("refresh_tokens_user_ix").on(t.userId),
    familyIx: index("refresh_tokens_family_ix").on(t.familyId),
  }),
);
