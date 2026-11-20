import { one, query } from "../db";
import { ERR } from "../errors";
import { capsuleListItem, CapsuleRow, dbTimestamp, iso, OwnerBrief, pagination } from "../types";
import { findUserById } from "./auth";
import { rowOwner } from "./capsules";

const publicCapsules = "FROM capsules c WHERE c.in_plaza = ?";
const capsulesWithOwner = "FROM capsules c JOIN users u ON u.id = c.owner_id";
const openCounts = `count(CASE WHEN c.open_at <= ? THEN 1 END) AS opened,
                    count(CASE WHEN c.open_at > ? THEN 1 END) AS unopened`;
type Counter = number | string;

function plazaConditions(q: string | null) {
  const search = q?.trim() ?? "";
  if ([...search].length > 50) throw ERR.validation("q 长度不得超过 50", "q");
  const where = ["c.in_plaza = ?"];
  const params: unknown[] = [true];
  if (search) {
    const literal = search.toLowerCase().replace(/[\\%_]/g, "\\$&");
    const pattern = "%" + literal + "%";
    where.push("(lower(c.title) LIKE ? ESCAPE '\\' OR lower(u.nickname) LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  return { where, params };
}

function validatePage(page: number, pageSize: number) {
  if (!Number.isInteger(page) || page < 1) throw ERR.validation("page 必须 >= 1", "page");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw ERR.validation("pageSize 范围 1-50", "pageSize");
  }
}

async function favoriteSet(viewerId: string | null, ids: string[]) {
  if (!viewerId || ids.length === 0) return new Set<string>();
  const marks = ids.map(() => "?").join(",");
  const rows = await query<{ capsuleId: string }>(
    `SELECT capsule_id AS "capsuleId" FROM favorites
      WHERE user_id = ? AND capsule_id IN (${marks})`,
    [viewerId, ...ids],
  );
  return new Set(rows.map((r) => r.capsuleId));
}

export async function plazaList(opts: {
  sort: string;
  filter: string;
  q: string | null;
  page: number;
  pageSize: number;
  viewerId: string | null;
}) {
  if (!["hot", "new"].includes(opts.sort)) throw ERR.validation("sort 仅支持 hot/new", "sort");
  if (!["all", "opened", "unopened"].includes(opts.filter)) {
    throw ERR.validation("filter 仅支持 all/opened/unopened", "filter");
  }
  validatePage(opts.page, opts.pageSize);
  const { where, params } = plazaConditions(opts.q);
  const now = dbTimestamp(new Date());
  if (opts.filter === "opened") {
    where.push("c.open_at <= ?");
    params.push(now);
  } else if (opts.filter === "unopened") {
    where.push("c.open_at > ?");
    params.push(now);
  }
  const clause = where.join(" AND ");
  const order =
    opts.sort === "hot"
      ? "c.favorite_count DESC, c.created_at DESC"
      : "c.created_at DESC";
  const rows = await query<CapsuleRow & OwnerBrief>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.nickname, u.avatar_id AS "avatarId"
       ${capsulesWithOwner}
      WHERE ${clause}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, (opts.page - 1) * opts.pageSize],
  );
  const count = await one<{ n: string | number }>(
    `SELECT count(*) AS n ${capsulesWithOwner} WHERE ${clause}`,
    params,
  );
  const faved = await favoriteSet(opts.viewerId, rows.map((r) => r.id));
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), faved.has(r.id))),
    pagination: pagination(Number(count?.n ?? 0), opts.page, opts.pageSize),
  };
}

export async function plazaStats(q: string | null) {
  const now = dbTimestamp(new Date());
  const { where, params } = plazaConditions(q);
  const counts = await one<{ total: Counter; opened: Counter; unopened: Counter }>(
    `SELECT count(*) AS total, ${openCounts} ${capsulesWithOwner} WHERE ${where.join(" AND ")}`,
    [now, now, ...params],
  );
  const farthest = await one<{ time: string | Date }>(
    `SELECT c.open_at AS time ${publicCapsules} ORDER BY c.open_at DESC LIMIT 1`, [true],
  );
  const next = await one<{ time: string | Date }>(
    `SELECT c.open_at AS time ${publicCapsules} AND c.open_at > ? ORDER BY c.open_at ASC LIMIT 1`, [true, now],
  );
  return {
    counts: {
      all: Number(counts?.total ?? 0),
      opened: Number(counts?.opened ?? 0),
      unopened: Number(counts?.unopened ?? 0),
    },
    farthestOpenAt: farthest ? iso(farthest.time) : null,
    nextOpenAt: next ? iso(next.time) : null,
  };
}

export async function myStats(userId: string) {
  if (!(await findUserById(userId))) throw ERR.unauthorized();
  const now = dbTimestamp(new Date());
  const counts = await one<{
    created: Counter; opened: Counter; unopened: Counter; inPlaza: Counter; favoritesReceived: Counter;
  }>(
    `SELECT count(*) AS created, ${openCounts},
            count(CASE WHEN c.in_plaza THEN 1 END) AS "inPlaza",
            COALESCE(sum(c.favorite_count), 0) AS "favoritesReceived"
       FROM capsules c WHERE c.owner_id = ?`,
    [now, now, userId],
  );
  const given = await one<{ total: Counter }>("SELECT count(*) AS total FROM favorites WHERE user_id = ?", [userId]);
  return {
    created: Number(counts?.created ?? 0),
    opened: Number(counts?.opened ?? 0),
    unopened: Number(counts?.unopened ?? 0),
    inPlaza: Number(counts?.inPlaza ?? 0),
    favoritesReceived: Number(counts?.favoritesReceived ?? 0),
    favoritesGiven: Number(given?.total ?? 0),
  };
}

export async function myCapsules(userId: string, page: number, pageSize: number) {
  validatePage(page, pageSize);
  const count = await one<{ n: string | number }>(`SELECT count(*) AS n FROM capsules WHERE owner_id = ?`, [
    userId,
  ]);
  const rows = await query<CapsuleRow & OwnerBrief>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.nickname, u.avatar_id AS "avatarId"
       FROM capsules c
       JOIN users u ON u.id = c.owner_id
      WHERE c.owner_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  const faved = await favoriteSet(userId, rows.map((row) => row.id));
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), faved.has(r.id))),
    pagination: pagination(Number(count?.n ?? 0), page, pageSize),
  };
}

export async function myFavorites(userId: string, page: number, pageSize: number) {
  validatePage(page, pageSize);
  const count = await one<{ n: string | number }>(`SELECT count(*) AS n FROM favorites WHERE user_id = ?`, [
    userId,
  ]);
  const rows = await query<CapsuleRow & OwnerBrief & { favoritedAt: string }>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.nickname, u.avatar_id AS "avatarId",
            f.created_at AS "favoritedAt"
       FROM favorites f
       JOIN capsules c ON c.id = f.capsule_id
       JOIN users u ON u.id = c.owner_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), true, iso(r.favoritedAt))),
    pagination: pagination(Number(count?.n ?? 0), page, pageSize),
  };
}
