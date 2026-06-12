import { one, query } from "../db";
import { ERR } from "../errors";
import { capsuleListItem, CapsuleRow, iso, OwnerBrief, pagination } from "../types";
import { rowOwner } from "./capsules";

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
  const q = (opts.q ?? "").trim();
  if (q.length > 50) throw ERR.validation("q 长度不得超过 50", "q");

  const where: string[] = ["c.in_plaza = ?"];
  const params: unknown[] = [true];
  const now = new Date().toISOString();
  if (opts.filter === "opened") {
    where.push("c.open_at <= ?");
    params.push(now);
  } else if (opts.filter === "unopened") {
    where.push("c.open_at > ?");
    params.push(now);
  }
  if (q) {
    where.push("(lower(c.title) LIKE ? OR lower(u.nickname) LIKE ?)");
    params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
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
       FROM capsules c
       JOIN users u ON u.id = c.owner_id
      WHERE ${clause}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, (opts.page - 1) * opts.pageSize],
  );
  const count = await one<{ n: string | number }>(
    `SELECT count(*) AS n FROM capsules c JOIN users u ON u.id = c.owner_id WHERE ${clause}`,
    params,
  );
  const faved = await favoriteSet(opts.viewerId, rows.map((r) => r.id));
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), faved.has(r.id))),
    pagination: pagination(Number(count?.n ?? 0), opts.page, opts.pageSize),
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
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), false)),
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
