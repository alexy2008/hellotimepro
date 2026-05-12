import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getCtx } from "@/db";
import { ERR } from "@/lib/server/errors";
import type { FavoriteResult } from "@/types";

/*
 * 并发取舍说明（教学项目，按 CLAUDE.md "生产级安全/并发问题不作为修复优先项"）
 *
 * 当前 addFavorite / removeFavorite 是「SELECT → INSERT/DELETE → UPDATE 计数」
 * 三段非事务，存在并发漂移：
 *   - 两个并发 addFavorite(同 user, 同 capsule) 都看到 exist[0] 为空，
 *     第二个 INSERT 会因复合主键冲突抛 500。
 *   - favorite_count 的 += 1 / -= 1 SQL 表达式本身原子，但和前面的存在性
 *     检查之间没有锁。
 *
 * 生产化做法：
 *   - 用 `db.transaction(...)` 包住三段；或对 capsules 行加 SELECT ... FOR UPDATE。
 *   - 或彻底改成 UPSERT：INSERT ... ON CONFLICT DO NOTHING RETURNING ...
 *
 * 教学项目里两种都没做，原因：M2 验证不覆盖并发；保留代码线性可读性给读者。
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
