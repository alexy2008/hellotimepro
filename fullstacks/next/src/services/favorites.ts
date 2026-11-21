import "server-only";

import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { withTx } from "@/db";
import { ERR } from "@/lib/server/errors";
import { dashed, idCandidates, iso, requireUuid } from "@/lib/server/ids";
import type { FavoriteResult } from "@/types";

/*
 * 收藏 / 取消收藏：维护 favorites 表与 capsules.favorite_count 的一致性。
 *
 * - favorites 行变更与 favorite_count ± 1 在同一事务（withTx）
 * - PostgreSQL 先 `SELECT … FOR UPDATE` 锁胶囊行，加锁顺序与删除胶囊一致（胶囊 → 收藏）
 * - 重复收藏幂等：返回当前状态；取消未收藏的也幂等
 * - 2.0 起不校验胶囊状态：自己的、inPlaza = false 的、未开启 / 已开启的都可以收藏，
 *   只要求胶囊存在（作者给自己 +1 也计入「最热」，与 fastapi 一致）
 */

/** 事务内按外部 id 找胶囊（SQLite 两种 UUID 存法都匹配），PostgreSQL 锁行。 */
async function lockCapsule(
  ctx: Parameters<Parameters<typeof withTx>[0]>[0],
  capsuleId: string,
) {
  const { db, t, kind } = ctx;
  const q = db
    .select({ id: t.capsules.id, favoriteCount: t.capsules.favoriteCount, ownerId: t.capsules.ownerId })
    .from(t.capsules)
    .where(inArray(t.capsules.id, idCandidates(capsuleId, kind)))
    .limit(1);
  const rows = kind === "postgres" ? await q.for("update") : await q;
  return rows[0] as { id: string; favoriteCount: number; ownerId: string } | undefined;
}

export { lockCapsule };

export async function addFavorite(userId: string, capsuleId: string): Promise<FavoriteResult> {
  requireUuid(capsuleId, "capsuleId");
  return withTx(async (ctx) => {
    const { db, t } = ctx;
    const capsule = await lockCapsule(ctx, capsuleId);
    if (!capsule) throw ERR.notFound("胶囊不存在");

    const exist = await db
      .select({ createdAt: t.favorites.createdAt })
      .from(t.favorites)
      .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsule.id)))
      .limit(1);
    if (exist[0]) {
      return {
        capsuleId: dashed(capsule.id),
        favoriteCount: Number(capsule.favoriteCount),
        favoritedAt: iso(exist[0].createdAt),
      };
    }

    const now = new Date().toISOString();
    await db.insert(t.favorites).values({ userId, capsuleId: capsule.id, createdAt: now });
    await db
      .update(t.capsules)
      .set({ favoriteCount: sql`${t.capsules.favoriteCount} + 1` })
      .where(eq(t.capsules.id, capsule.id));
    const updated = await db
      .select({ favoriteCount: t.capsules.favoriteCount })
      .from(t.capsules)
      .where(eq(t.capsules.id, capsule.id))
      .limit(1);
    return {
      capsuleId: dashed(capsule.id),
      favoriteCount: Number(updated[0]?.favoriteCount ?? Number(capsule.favoriteCount) + 1),
      favoritedAt: now,
    };
  });
}

export async function removeFavorite(userId: string, capsuleId: string): Promise<void> {
  requireUuid(capsuleId, "capsuleId");
  await withTx(async (ctx) => {
    const { db, t } = ctx;
    const capsule = await lockCapsule(ctx, capsuleId);
    if (!capsule) return;
    const exist = await db
      .select({ userId: t.favorites.userId })
      .from(t.favorites)
      .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsule.id)))
      .limit(1);
    if (!exist[0]) return;
    await db
      .delete(t.favorites)
      .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsule.id)));
    await db
      .update(t.capsules)
      .set({ favoriteCount: sql`${t.capsules.favoriteCount} - 1` })
      .where(and(eq(t.capsules.id, capsule.id), gt(t.capsules.favoriteCount, 0)));
  });
}
