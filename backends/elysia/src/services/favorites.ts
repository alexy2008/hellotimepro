import { dbKind, tx } from "../db";
import { ERR } from "../errors";
import { bool, CapsuleRow, iso } from "../types";

export async function addFavorite(userId: string, capsuleId: string) {
  return tx(async (q) => {
    const locking = (await dbKind()) === "postgres" ? " FOR UPDATE" : "";
    const capsules = await q<CapsuleRow>(
      `SELECT id, owner_id AS "ownerId", code, title, content, open_at AS "openAt",
              in_plaza AS "inPlaza", favorite_count AS "favoriteCount",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM capsules WHERE id = ?${locking}`,
      [capsuleId],
    );
    const capsule = capsules[0];
    if (!capsule || !bool(capsule.inPlaza)) throw ERR.notFound("胶囊不存在");
    if (capsule.ownerId === userId) throw ERR.badRequest("不能收藏自己创建的胶囊");

    const existing = await q<{ createdAt: string }>(
      `SELECT created_at AS "createdAt" FROM favorites WHERE user_id = ? AND capsule_id = ? LIMIT 1`,
      [userId, capsuleId],
    );
    if (existing[0]) {
      return {
        capsuleId,
        favoriteCount: Number(capsule.favoriteCount),
        favoritedAt: iso(existing[0].createdAt),
      };
    }
    const now = new Date().toISOString();
    await q(`INSERT INTO favorites (user_id, capsule_id, created_at) VALUES (?, ?, ?)`, [
      userId,
      capsuleId,
      now,
    ]);
    await q(`UPDATE capsules SET favorite_count = favorite_count + 1 WHERE id = ?`, [capsuleId]);
    const updated = await q<{ favoriteCount: number }>(
      `SELECT favorite_count AS "favoriteCount" FROM capsules WHERE id = ?`,
      [capsuleId],
    );
    return { capsuleId, favoriteCount: Number(updated[0]?.favoriteCount ?? 1), favoritedAt: now };
  });
}

export async function removeFavorite(userId: string, capsuleId: string) {
  await tx(async (q) => {
    const existing = await q(`SELECT 1 FROM favorites WHERE user_id = ? AND capsule_id = ? LIMIT 1`, [
      userId,
      capsuleId,
    ]);
    if (!existing[0]) return;
    await q(`DELETE FROM favorites WHERE user_id = ? AND capsule_id = ?`, [userId, capsuleId]);
    await q(
      `UPDATE capsules
          SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END
        WHERE id = ?`,
      [capsuleId],
    );
  });
}
