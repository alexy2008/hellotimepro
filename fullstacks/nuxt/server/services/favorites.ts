import { and, eq, sql } from "drizzle-orm";
import { getCtx } from "~/server/db";
import { ERR } from "~/server/lib/errors";
import type { FavoriteResult } from "~/types";

/*
 * 并发取舍说明（教学项目，见 docs/03-roadmap.md 的 M2 已知问题）
 *
 * 当前 addFavorite / removeFavorite 是「SELECT → INSERT/DELETE → UPDATE 计数」
 * 三段非事务，和 Next.js 全栈实现保持同构。favorite_count 的 += 1 / -= 1
 * SQL 表达式本身是原子的，但 favorites 行变更与计数更新之间没有事务边界；
 * 极端并发下可能出现复合主键冲突或计数漂移。
 *
 * 生产化做法：用 `db.transaction(...)` 包住三段；Postgres 可对 capsules 行
 * SELECT ... FOR UPDATE；或改成 INSERT ... ON CONFLICT DO NOTHING RETURNING ...
 * 让“是否真的插入”成为计数更新的唯一依据。
 */

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
