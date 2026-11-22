import { inArray } from "drizzle-orm";
import type { DbContext } from "~/server/db";
import { capsuleIds } from "~/server/lib/records";

/** 三种写操作都先定位并锁定胶囊，再修改收藏。SQLite 事务已持有写锁。 */
export async function lockCapsule(ctx: DbContext, id: string, field: string) {
  const { db, t, kind } = ctx;
  const query = db.select({
    id: t.capsules.id,
    ownerId: t.capsules.ownerId,
    favoriteCount: t.capsules.favoriteCount,
  }).from(t.capsules).where(inArray(t.capsules.id, capsuleIds(id, kind, field))).limit(1);
  const [capsule] = await (kind === "postgres" ? query.for("update") : query);
  return capsule;
}
