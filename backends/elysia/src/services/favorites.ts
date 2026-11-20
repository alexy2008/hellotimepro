import { tx } from "../db";
import { ERR } from "../errors";
import { canonicalCapsuleId, dbTimestamp, iso } from "../types";
import { lockCapsule } from "./capsules";

export async function addFavorite(userId: string, requestedId: string) {
  return tx(async (q) => {
    const capsule = await lockCapsule(q, requestedId);
    if (!capsule) throw ERR.notFound("胶囊不存在");
    const capsuleId = capsule.id;

    const existing = await q<{ createdAt: string }>(
      `SELECT created_at AS "createdAt" FROM favorites WHERE user_id = ? AND capsule_id = ? LIMIT 1`,
      [userId, capsuleId],
    );
    if (existing[0]) {
      return {
        capsuleId: canonicalCapsuleId(capsuleId),
        favoriteCount: Number(capsule.favoriteCount),
        favoritedAt: iso(existing[0].createdAt),
      };
    }
    const now = dbTimestamp(new Date());
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
    return {
      capsuleId: canonicalCapsuleId(capsuleId),
      favoriteCount: Number(updated[0]?.favoriteCount ?? 1),
      favoritedAt: iso(now),
    };
  });
}

export async function removeFavorite(userId: string, requestedId: string) {
  await tx(async (q) => {
    const capsule = await lockCapsule(q, requestedId);
    if (!capsule) return;
    const capsuleId = capsule.id;
    const deleted = await q<{ deleted: number }>(
      `DELETE FROM favorites WHERE user_id = ? AND capsule_id = ? RETURNING 1 AS deleted`,
      [userId, capsuleId],
    );
    if (!deleted[0]) return;
    await q(
      `UPDATE capsules
          SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END
        WHERE id = ?`,
      [capsuleId],
    );
  });
}
