import { and, eq, sql } from "drizzle-orm";
import { getCtx } from "~/server/db";
import { ERR } from "~/server/lib/errors";
import type { FavoriteResult } from "~/types";

export async function addFavorite(
  userId: string,
  capsuleId: string,
): Promise<FavoriteResult> {
  const { db, t } = await getCtx();
  const capsuleRows = await db.select().from(t.capsules).where(eq(t.capsules.id, capsuleId)).limit(1);
  const capsule = capsuleRows[0];
  if (!capsule || !capsule.inPlaza) throw ERR.notFound("胶囊不存在");
  if (capsule.ownerId === userId) throw ERR.badRequest("不能收藏自己创建的胶囊");

  const exist = await db
    .select()
    .from(t.favorites)
    .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsuleId)))
    .limit(1);
  if (exist[0]) {
    return {
      capsuleId,
      favoriteCount: capsule.favoriteCount,
      favoritedAt: exist[0].createdAt as string,
    };
  }
  const now = new Date().toISOString();
  await db.insert(t.favorites).values({ userId, capsuleId, createdAt: now });
  await db
    .update(t.capsules)
    .set({ favoriteCount: sql`${t.capsules.favoriteCount} + 1` })
    .where(eq(t.capsules.id, capsuleId));
  // 重新读最新计数
  const updated = await db
    .select({ favoriteCount: t.capsules.favoriteCount })
    .from(t.capsules)
    .where(eq(t.capsules.id, capsuleId))
    .limit(1);
  return {
    capsuleId,
    favoriteCount: Number(updated[0]?.favoriteCount ?? capsule.favoriteCount + 1),
    favoritedAt: now,
  };
}

export async function removeFavorite(userId: string, capsuleId: string): Promise<void> {
  const { db, t } = await getCtx();
  const exist = await db
    .select()
    .from(t.favorites)
    .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsuleId)))
    .limit(1);
  if (!exist[0]) return;
  await db
    .delete(t.favorites)
    .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsuleId)));
  await db
    .update(t.capsules)
    .set({ favoriteCount: sql`CASE WHEN ${t.capsules.favoriteCount} > 0 THEN ${t.capsules.favoriteCount} - 1 ELSE 0 END` })
    .where(eq(t.capsules.id, capsuleId));
}
