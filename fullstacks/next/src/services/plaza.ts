import "server-only";

import { and, desc, eq, gt, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getCtx } from "@/db";
import { ERR } from "@/lib/server/errors";
import { dashed, iso } from "@/lib/server/ids";
import type { CapsuleListItem, MyStats, PaginatedCapsules, PlazaStats } from "@/types";

interface CapsuleRow {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  content: string;
  openAt: string;
  inPlaza: boolean;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  nickname: string;
  avatarId: string;
}

function contentPreview(content: string, opened: boolean): string | null {
  if (!opened || !content) return null;
  const trimmed = content.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
}

function toItem(
  c: CapsuleRow,
  owner: UserRow,
  favoritedByMe: boolean,
  favoritedAt: string | null = null,
): CapsuleListItem {
  const opened = new Date(c.openAt) <= new Date();
  return {
    id: dashed(c.id),
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: iso(c.openAt),
    createdAt: iso(c.createdAt),
    inPlaza: !!c.inPlaza,
    favoriteCount: Number(c.favoriteCount),
    isOpened: opened,
    favoritedByMe,
    favoritedAt: favoritedAt ? iso(favoritedAt) : null,
    contentPreview: contentPreview(c.content, opened),
  };
}

function paginate(total: number, page: number, pageSize: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize ? Math.ceil(total / pageSize) : 0,
  };
}

async function favoritedSet(viewerId: string | null, capsuleIds: string[]): Promise<Set<string>> {
  if (!viewerId || capsuleIds.length === 0) return new Set();
  const { db, t } = await getCtx();
  const rows = await db
    .select({ capsuleId: t.favorites.capsuleId })
    .from(t.favorites)
    .where(and(eq(t.favorites.userId, viewerId), inArray(t.favorites.capsuleId, capsuleIds)));
  return new Set(rows.map((r) => r.capsuleId));
}

/** 校验并 trim `q`；超过 50 字符 → 422。列表与统计共用同一口径。 */
function normalizeQ(q: string | null | undefined): string {
  const trimmed = (q ?? "").trim();
  if (trimmed.length > 50) throw ERR.validation("q 长度不得超过 50", "q");
  return trimmed;
}

/**
 * 标题或作者昵称的字面子串匹配（大小写不敏感）。
 * LIKE 的通配符先转义（\ → \\、% → \%、_ → \_），再加 ESCAPE '\'——PostgreSQL 与 SQLite 都要，
 * 否则搜 "_" 会匹配所有标题。
 */
async function queryCond(q: string): Promise<SQL | undefined> {
  if (!q) return undefined;
  const { t } = await getCtx();
  const literal = q.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pattern = `%${literal}%`;
  return or(
    sql`lower(${t.capsules.title}) like ${pattern} escape '\\'`,
    sql`lower(${t.users.nickname}) like ${pattern} escape '\\'`,
  );
}

export async function plazaList(opts: {
  sort: "hot" | "new";
  filter: "all" | "opened" | "unopened";
  q: string | null;
  page: number;
  pageSize: number;
  viewerId: string | null;
}): Promise<PaginatedCapsules> {
  if (!["hot", "new"].includes(opts.sort)) throw ERR.validation("sort 仅支持 hot/new", "sort");
  if (!["all", "opened", "unopened"].includes(opts.filter))
    throw ERR.validation("filter 仅支持 all/opened/unopened", "filter");
  if (opts.page < 1) throw ERR.validation("page 必须 >= 1", "page");
  if (opts.pageSize < 1 || opts.pageSize > 50) throw ERR.validation("pageSize 范围 1-50", "pageSize");
  const q = normalizeQ(opts.q);

  const { db, t } = await getCtx();
  const nowIso = new Date().toISOString();

  const conds: SQL[] = [eq(t.capsules.inPlaza, true)];
  if (opts.filter === "opened") conds.push(lte(t.capsules.openAt, nowIso));
  else if (opts.filter === "unopened") conds.push(gt(t.capsules.openAt, nowIso));
  const qc = await queryCond(q);
  if (qc) conds.push(qc);
  const where = and(...conds)!;

  const orderBy =
    opts.sort === "hot"
      ? [desc(t.capsules.favoriteCount), desc(t.capsules.createdAt)]
      : [desc(t.capsules.createdAt)];

  // 数据
  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  // 总数
  const totalRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(where);
  const total = Number(totalRows[0]?.n ?? 0);

  const ids = rows.map((r) => (r.capsule as CapsuleRow).id);
  const faved = await favoritedSet(opts.viewerId, ids);
  const items = rows.map((r) =>
    toItem(r.capsule as CapsuleRow, r.owner as UserRow, faved.has((r.capsule as CapsuleRow).id)),
  );
  return { items, pagination: paginate(total, opts.page, opts.pageSize) };
}

export async function myCapsules(opts: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedCapsules> {
  if (opts.page < 1) throw ERR.validation("page 必须 >= 1", "page");
  if (opts.pageSize < 1 || opts.pageSize > 50)
    throw ERR.validation("pageSize 范围 1-50", "pageSize");
  const { db, t } = await getCtx();
  const totalRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.capsules)
    .where(eq(t.capsules.ownerId, opts.userId));
  const total = Number(totalRows[0]?.n ?? 0);
  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(eq(t.capsules.ownerId, opts.userId))
    .orderBy(desc(t.capsules.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);
  // 2.0 起可以收藏自己的胶囊，favoritedByMe 照常计算
  const faved = await favoritedSet(
    opts.userId,
    rows.map((r) => (r.capsule as CapsuleRow).id),
  );
  const items = rows.map((r) =>
    toItem(r.capsule as CapsuleRow, r.owner as UserRow, faved.has((r.capsule as CapsuleRow).id)),
  );
  return { items, pagination: paginate(total, opts.page, opts.pageSize) };
}

export async function myFavorites(opts: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedCapsules> {
  if (opts.page < 1) throw ERR.validation("page 必须 >= 1", "page");
  if (opts.pageSize < 1 || opts.pageSize > 50)
    throw ERR.validation("pageSize 范围 1-50", "pageSize");
  const { db, t } = await getCtx();
  const totalRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.favorites)
    .where(eq(t.favorites.userId, opts.userId));
  const total = Number(totalRows[0]?.n ?? 0);

  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
      favoritedAt: t.favorites.createdAt,
    })
    .from(t.favorites)
    .innerJoin(t.capsules, eq(t.favorites.capsuleId, t.capsules.id))
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(eq(t.favorites.userId, opts.userId))
    .orderBy(desc(t.favorites.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  const items = rows.map((r) =>
    toItem(r.capsule as CapsuleRow, r.owner as UserRow, true, r.favoritedAt as string),
  );
  return { items, pagination: paginate(total, opts.page, opts.pageSize) };
}

// ---------------------------------------------------------------- 统计（2.0）

/** 条件计数：coalesce(sum(CASE WHEN cond THEN 1 ELSE 0 END), 0)，两种方言写法一致。 */
function countIf(cond: SQL) {
  return sql<number>`coalesce(sum(case when ${cond} then 1 else 0 end), 0)`;
}

/**
 * counts 与列表共用同一套 where（inPlaza + q），保证与三种 filter 下的 total 一致；
 * 两个时刻不受 q 影响。「现在」只取一次，避免边界上 opened + unopened != all。
 * 时刻用 ORDER BY … LIMIT 1 取列（SQLite 下 MAX/MIN 聚合会丢掉列类型）。
 */
export async function plazaStats(rawQ: string | null): Promise<PlazaStats> {
  const q = normalizeQ(rawQ);
  const { db, t } = await getCtx();
  const nowIso = new Date().toISOString();

  const conds: SQL[] = [eq(t.capsules.inPlaza, true)];
  const qc = await queryCond(q);
  if (qc) conds.push(qc);
  const [row] = await db
    .select({
      all: sql<number>`count(*)`,
      opened: countIf(lte(t.capsules.openAt, nowIso)!),
      unopened: countIf(gt(t.capsules.openAt, nowIso)!),
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(and(...conds));

  const farthest = await db
    .select({ openAt: t.capsules.openAt })
    .from(t.capsules)
    .where(eq(t.capsules.inPlaza, true))
    .orderBy(desc(t.capsules.openAt))
    .limit(1);
  const next = await db
    .select({ openAt: t.capsules.openAt })
    .from(t.capsules)
    .where(and(eq(t.capsules.inPlaza, true), gt(t.capsules.openAt, nowIso)))
    .orderBy(t.capsules.openAt)
    .limit(1);

  return {
    counts: {
      all: Number(row?.all ?? 0),
      opened: Number(row?.opened ?? 0),
      unopened: Number(row?.unopened ?? 0),
    },
    farthestOpenAt: farthest[0] ? iso(farthest[0].openAt) : null,
    nextOpenAt: next[0] ? iso(next[0].openAt) : null,
  };
}

/** 当前用户统计：含未公开胶囊；favoritesReceived = 我的胶囊 favoriteCount 之和。 */
export async function myStats(userId: string): Promise<MyStats> {
  const { db, t } = await getCtx();
  const nowIso = new Date().toISOString();
  const [row] = await db
    .select({
      created: sql<number>`count(*)`,
      opened: countIf(lte(t.capsules.openAt, nowIso)!),
      unopened: countIf(gt(t.capsules.openAt, nowIso)!),
      inPlaza: countIf(eq(t.capsules.inPlaza, true)),
      received: sql<number>`coalesce(sum(${t.capsules.favoriteCount}), 0)`,
    })
    .from(t.capsules)
    .where(eq(t.capsules.ownerId, userId));
  const [given] = await db
    .select({ n: sql<number>`count(*)` })
    .from(t.favorites)
    .where(eq(t.favorites.userId, userId));
  return {
    created: Number(row?.created ?? 0),
    opened: Number(row?.opened ?? 0),
    unopened: Number(row?.unopened ?? 0),
    inPlaza: Number(row?.inPlaza ?? 0),
    favoritesReceived: Number(row?.received ?? 0),
    favoritesGiven: Number(given?.n ?? 0),
  };
}
