import { and, eq } from "drizzle-orm";
import { defineEventHandler, getRouterParam } from "h3";
import { getCtx } from "~/server/db";
import { withApi } from "~/server/lib/envelope";
import { ERR } from "~/server/lib/errors";
import { readClaims } from "~/server/lib/current-user";
import type { CapsuleDetail } from "~/types";

export default defineEventHandler((event) =>
  withApi<CapsuleDetail>(event, async () => {
    const id = getRouterParam(event, "id") ?? "";
    const claims = await readClaims(event);
    const { db, t } = await getCtx();
    const rows = await db
      .select({
        capsule: t.capsules,
        owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
      })
      .from(t.capsules)
      .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
      .where(and(eq(t.capsules.id, id), eq(t.capsules.inPlaza, true)))
      .limit(1);
    const row = rows[0];
    if (!row) throw ERR.notFound("胶囊不存在");
    const c = row.capsule as {
      id: string;
      code: string;
      title: string;
      content: string;
      openAt: string;
      inPlaza: boolean;
      favoriteCount: number;
      createdAt: string;
    };
    let favoritedByMe = false;
    if (claims) {
      const fav = await db
        .select()
        .from(t.favorites)
        .where(and(eq(t.favorites.userId, claims.id), eq(t.favorites.capsuleId, c.id)))
        .limit(1);
      favoritedByMe = !!fav[0];
    }
    const opened = new Date(c.openAt) <= new Date();
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      creator: row.owner,
      openAt: c.openAt,
      createdAt: c.createdAt,
      inPlaza: !!c.inPlaza,
      favoriteCount: c.favoriteCount,
      isOpened: opened,
      content: opened ? c.content : null,
      favoritedByMe,
    };
  }),
);
