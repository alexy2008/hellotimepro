import "server-only";

import { and, asc, desc, eq, gt, inArray, lte, like, or, sql } from "drizzle-orm";
import { getCtx } from "@/db";
import { ERR } from "@/lib/server/errors";
import type { CapsuleListItem, PaginatedCapsules } from "@/types";

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
    id: c.id,
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: c.openAt,
    createdAt: c.createdAt,
    inPlaza: !!c.inPlaza,
    favoriteCount: c.favoriteCount,
    isOpened: opened,
    favoritedByMe,
    favoritedAt,
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
  const q = (opts.q ?? "").trim();
  if (q.length > 50) throw ERR.validation("q 长度不得超过 50", "q");

  const { db, t } = await getCtx();
  const nowIso = new Date().toISOString();

  const conds = [eq(t.capsules.inPlaza, true)];
  if (opts.filter === "opened") conds.push(lte(t.capsules.openAt, nowIso));
  else if (opts.filter === "unopened") conds.push(gt(t.capsules.openAt, nowIso));
  if (q) {
    const pattern = `%${q.toLowerCase()}%`;
    conds.push(
      or(
        sql`lower(${t.capsules.title}) like ${pattern}`,
        sql`lower(${t.users.nickname}) like ${pattern}`,
      )!,
    );
  }
  const where = conds.length === 1 ? conds[0] : and(...conds)!;

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
  const items = rows.map((r) => toItem(r.capsule as CapsuleRow, r.owner as UserRow, false));
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
