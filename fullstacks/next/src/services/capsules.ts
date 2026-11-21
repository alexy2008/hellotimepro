import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getCtx, withTx } from "@/db";
import { ERR } from "@/lib/server/errors";
import { addCalendarYears, dashed, idCandidates, iso, requireUuid } from "@/lib/server/ids";
import { lockCapsule } from "./favorites";
import type { CapsuleDetail, CreateCapsuleRequest } from "@/types";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

interface CapsuleRow {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  content: string;
  openAt: string;
  inPlaza: boolean;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  nickname: string;
  avatarId: string;
}

export function toDetail(
  c: CapsuleRow,
  owner: UserRow,
  viewerId: string | null,
  favoritedByMe: boolean,
): CapsuleDetail {
  const opened = new Date(c.openAt) <= new Date();
  return {
    id: dashed(c.id),
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: iso(c.openAt),
    createdAt: iso(c.createdAt),
    inPlaza: !!c.inPlaza,
    favoriteCount: Number(c.favoriteCount),
    isOpened: opened,
    content: opened ? c.content : null,
    favoritedByMe,
  };
}

export async function createCapsule(
  ownerId: string,
  req: CreateCapsuleRequest,
): Promise<CapsuleDetail> {
  const { db, t } = await getCtx();
  // 校验 openAt >= now + 60s 且 <= 此刻往后 10 个日历年（openapi 2.0.0，不是固定 3650 天）
  const openAt = new Date(req.openAt);
  if (Number.isNaN(openAt.getTime())) throw ERR.validation("openAt 不是合法时间", "openAt");
  const now = new Date();
  if (openAt.getTime() < now.getTime() + 60_000) {
    throw ERR.validation("openAt 必须晚于当前时间 60 秒以上", "openAt");
  }
  if (openAt.getTime() > addCalendarYears(now, 10).getTime()) {
    throw ERR.validation("openAt 不得超出当前时间 10 年", "openAt");
  }

  const ownerRows = await db.select().from(t.users).where(eq(t.users.id, ownerId)).limit(1);
  const owner = ownerRows[0] as UserRow | undefined;
  if (!owner) throw ERR.unauthorized();

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const code = generateCode();
    try {
      await db.insert(t.capsules).values({
        id,
        ownerId,
        code,
        title: req.title,
        content: req.content,
        openAt: openAt.toISOString(),
        inPlaza: req.inPlaza ?? true,
        favoriteCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      const row: CapsuleRow = {
        id,
        ownerId,
        code,
        title: req.title,
        content: req.content,
        openAt: openAt.toISOString(),
        inPlaza: req.inPlaza ?? true,
        favoriteCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      return toDetail(row, owner, ownerId, false);
    } catch (e) {
      lastErr = e as Error;
      // code 唯一约束冲突 → 重试
    }
  }
  throw ERR.internal("生成唯一码失败：" + (lastErr?.message ?? ""));
}

export async function getCapsuleByCode(
  code: string,
  viewerId: string | null,
): Promise<CapsuleDetail> {
  if (!/^[A-Za-z0-9]{8}$/.test(code)) {
    throw ERR.validation("胶囊码格式错误（须 8 位字母或数字）", "code");
  }
  const { db, t } = await getCtx();
  const codeNorm = code.toUpperCase();
  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(eq(t.capsules.code, codeNorm))
    .limit(1);
  const row = rows[0];
  if (!row) throw ERR.notFound("胶囊不存在");
  let favoritedByMe = false;
  if (viewerId) {
    const fav = await db
      .select()
      .from(t.favorites)
      .where(and(eq(t.favorites.userId, viewerId), eq(t.favorites.capsuleId, row.capsule.id)))
      .limit(1);
    favoritedByMe = !!fav[0];
  }
  return toDetail(row.capsule as CapsuleRow, row.owner as UserRow, viewerId, favoritedByMe);
}

export async function deleteOwnCapsule(userId: string, capsuleId: string): Promise<void> {
  requireUuid(capsuleId, "id");
  await withTx(async (ctx) => {
    const { db, t } = ctx;
    // 先锁胶囊行，再删收藏：与收藏 / 取消收藏的加锁顺序一致（胶囊 → 收藏），避免 PostgreSQL 死锁
    const c = await lockCapsule(ctx, capsuleId);
    if (!c) throw ERR.notFound("胶囊不存在");
    if (c.ownerId !== userId) throw ERR.forbidden("无权删除他人胶囊");
    // 显式先删收藏：不依赖外键级联（SQLite 未开 foreign_keys 时级联不生效）
    await db.delete(t.favorites).where(eq(t.favorites.capsuleId, c.id));
    await db.delete(t.capsules).where(eq(t.capsules.id, c.id));
  });
}

/** 广场详情：只返回 inPlaza = true 的胶囊；路径 id 格式不合法 → 422。 */
export async function getPlazaCapsuleById(
  id: string,
  viewerId: string | null,
): Promise<CapsuleDetail> {
  requireUuid(id, "id");
  const { db, t, kind } = await getCtx();
  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(and(inArray(t.capsules.id, idCandidates(id, kind)), eq(t.capsules.inPlaza, true)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ERR.notFound("胶囊不存在");
  let favoritedByMe = false;
  if (viewerId) {
    const fav = await db
      .select({ userId: t.favorites.userId })
      .from(t.favorites)
      .where(and(eq(t.favorites.userId, viewerId), eq(t.favorites.capsuleId, row.capsule.id)))
      .limit(1);
    favoritedByMe = !!fav[0];
  }
  return toDetail(row.capsule as CapsuleRow, row.owner as UserRow, viewerId, favoritedByMe);
}
