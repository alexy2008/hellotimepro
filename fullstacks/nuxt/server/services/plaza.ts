import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { getCtx, type DbContext } from "~/server/db";
import { dashed, iso } from "~/server/lib/records";
import type { CapsuleListItem, MyStats, PaginatedCapsules, PlazaFilter, PlazaSort, PlazaStats } from "~/types";

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
  const chars = Array.from(content.trim());
  return chars.length > 80 ? chars.slice(0, 80).join("") + "…" : chars.join("");
}

function toItem(
  c: CapsuleRow,
  owner: UserRow,
  favoritedByMe: boolean,
  now: Date,
  favoritedAt: string | null = null,
): CapsuleListItem {
  const opened = new Date(c.openAt) <= now;
  return {
    id: dashed(c.id),
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: iso(c.openAt),
    createdAt: iso(c.createdAt),
    inPlaza: !!c.inPlaza,
    favoriteCount: c.favoriteCount,
    isOpened: opened,
    favoritedByMe,
    favoritedAt: favoritedAt === null ? null : iso(favoritedAt),
    contentPreview: contentPreview(c.content, opened),
  };
}

function paginate(total: number, page: number, pageSize: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
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

function plazaWhere(t: DbContext["t"], q: string) {
  const visible = eq(t.capsules.inPlaza, true);
  if (!q) return visible;
  const literal = q.toLowerCase().replace(/[\\%_]/g, "\\$&");
  const pattern = `%${literal}%`;
  return and(visible, or(
    sql`lower(${t.capsules.title}) like ${pattern} escape '\\'`,
    sql`lower(${t.users.nickname}) like ${pattern} escape '\\'`,
  ))!;
}

function openingBounds({ t, kind }: DbContext, now: Date) {
  const nowIso = now.toISOString();
  // SQLite 同时含历史应用的 Z 时间戳和种子 +00:00 时间戳，比较时间而非字符串。
  const openAt = kind === "sqlite" ? sql`julianday(${t.capsules.openAt})` : t.capsules.openAt;
  const cutoff = kind === "sqlite" ? sql`julianday(${nowIso})` : nowIso;
  return { openAt, opened: sql`${openAt} <= ${cutoff}`, unopened: sql`${openAt} > ${cutoff}` };
}

function countIf(condition: SQL) {
  return sql`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(Number);
}

export async function plazaList(opts: {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
  page: number;
  pageSize: number;
  viewerId: string | null;
}): Promise<PaginatedCapsules> {
  const ctx = await getCtx();
  const { db, t } = ctx;
  const now = new Date();
  const { opened, unopened } = openingBounds(ctx, now);
  const where = and(plazaWhere(t, opts.q), { all: undefined, opened, unopened }[opts.filter]);

  const createdAt = ctx.kind === "sqlite" ? sql`julianday(${t.capsules.createdAt})` : t.capsules.createdAt;
  const orderBy =
    opts.sort === "hot"
      ? [desc(t.capsules.favoriteCount), desc(createdAt), desc(t.capsules.id)]
      : [desc(createdAt), desc(t.capsules.id)];

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
    .select({ n: count() })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(where);
  const total = totalRows[0].n;

  const ids = rows.map((r) => r.capsule.id);
  const faved = await favoritedSet(opts.viewerId, ids);
  const items = rows.map((r) =>
    toItem(r.capsule, r.owner, faved.has(r.capsule.id), now),
  );
  return { items, pagination: paginate(total, opts.page, opts.pageSize) };
}

export async function myCapsules(opts: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedCapsules> {
  const { db, t } = await getCtx();
  const totalRows = await db
    .select({ n: count() })
    .from(t.capsules)
    .where(eq(t.capsules.ownerId, opts.userId));
  const total = totalRows[0].n;
  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(eq(t.capsules.ownerId, opts.userId))
    .orderBy(desc(t.capsules.createdAt), desc(t.capsules.id))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);
  const now = new Date();
  const faved = await favoritedSet(opts.userId, rows.map((r) => r.capsule.id));
  const items = rows.map((r) => toItem(r.capsule, r.owner, faved.has(r.capsule.id), now));
  return { items, pagination: paginate(total, opts.page, opts.pageSize) };
}

export async function myFavorites(opts: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedCapsules> {
  const { db, t } = await getCtx();
  const totalRows = await db
    .select({ n: count() })
    .from(t.favorites)
    .where(eq(t.favorites.userId, opts.userId));
  const total = totalRows[0].n;

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
    .orderBy(desc(t.favorites.createdAt), desc(t.capsules.id))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  const now = new Date();
  const items = rows.map((r) => toItem(r.capsule, r.owner, true, now, r.favoritedAt));
  return { items, pagination: paginate(total, opts.page, opts.pageSize) };
}


export async function plazaStats(q: string): Promise<PlazaStats> {
  const ctx = await getCtx();
  const { db, t } = ctx;
  const { opened, unopened, openAt } = openingBounds(ctx, new Date());
  const visible = eq(t.capsules.inPlaza, true);
  const [[counts], [farthest], [next]] = await Promise.all([
    db.select({ all: count(), opened: countIf(opened), unopened: countIf(unopened) })
      .from(t.capsules)
      .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
      .where(plazaWhere(t, q)),
    db.select({ openAt: t.capsules.openAt }).from(t.capsules)
      .where(visible).orderBy(desc(openAt)).limit(1),
    db.select({ openAt: t.capsules.openAt }).from(t.capsules)
      .where(and(visible, unopened)).orderBy(asc(openAt)).limit(1),
  ]);
  return {
    counts,
    farthestOpenAt: farthest ? iso(farthest.openAt) : null,
    nextOpenAt: next ? iso(next.openAt) : null,
  };
}

export async function myStats(userId: string): Promise<MyStats> {
  const ctx = await getCtx();
  const { db, t } = ctx;
  const { opened, unopened } = openingBounds(ctx, new Date());
  const [[capsules], [favorites]] = await Promise.all([
    db.select({
      created: count(),
      opened: countIf(opened),
      unopened: countIf(unopened),
      inPlaza: countIf(eq(t.capsules.inPlaza, true)),
      favoritesReceived: sql`coalesce(sum(${t.capsules.favoriteCount}), 0)`.mapWith(Number),
    }).from(t.capsules).where(eq(t.capsules.ownerId, userId)),
    db.select({ favoritesGiven: count() }).from(t.favorites).where(eq(t.favorites.userId, userId)),
  ]);
  return { ...capsules, ...favorites };
}
