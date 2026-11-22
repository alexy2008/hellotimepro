import { and, eq, gt, sql } from "drizzle-orm";
import { withCapsuleTransaction } from "~/server/db";
import { ERR } from "~/server/lib/errors";
import { dashed, iso } from "~/server/lib/records";
import type { FavoriteResult } from "~/types";
import { lockCapsule } from "./capsule-lock";

export function addFavorite(userId: string, capsuleId: string): Promise<FavoriteResult> {
  return withCapsuleTransaction(async (ctx) => {
    const { db, t } = ctx;
    const capsule = await lockCapsule(ctx, capsuleId, "capsuleId");
    if (!capsule) throw ERR.notFound("胶囊不存在");

    const favoritedAt = new Date().toISOString();
    const [added] = await db.insert(t.favorites)
      .values({ userId, capsuleId: capsule.id, createdAt: favoritedAt })
      .onConflictDoNothing()
      .returning({ createdAt: t.favorites.createdAt });

    if (!added) {
      const [existing] = await db.select({ createdAt: t.favorites.createdAt })
        .from(t.favorites)
        .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsule.id)));
      return { capsuleId: dashed(capsule.id), favoriteCount: capsule.favoriteCount, favoritedAt: iso(existing.createdAt) };
    }

    await db.update(t.capsules)
      .set({ favoriteCount: sql`${t.capsules.favoriteCount} + 1` })
      .where(eq(t.capsules.id, capsule.id));
    return { capsuleId: dashed(capsule.id), favoriteCount: capsule.favoriteCount + 1, favoritedAt };
  });
}

export function removeFavorite(userId: string, capsuleId: string): Promise<void> {
  return withCapsuleTransaction(async (ctx) => {
    const { db, t } = ctx;
    const capsule = await lockCapsule(ctx, capsuleId, "capsuleId");
    if (!capsule) return;
    const [removed] = await db.delete(t.favorites)
      .where(and(eq(t.favorites.userId, userId), eq(t.favorites.capsuleId, capsule.id)))
      .returning({ capsuleId: t.favorites.capsuleId });
    if (!removed) return;
    await db.update(t.capsules)
      .set({ favoriteCount: sql`${t.capsules.favoriteCount} - 1` })
      .where(and(eq(t.capsules.id, capsule.id), gt(t.capsules.favoriteCount, 0)));
  });
}
