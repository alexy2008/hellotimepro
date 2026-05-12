import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getCtx } from "@/db";
import { ERR } from "@/lib/server/errors";
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

function toDetail(
  c: CapsuleRow,
  owner: UserRow,
  viewerId: string | null,
  favoritedByMe: boolean,
): CapsuleDetail {
  const opened = new Date(c.openAt) <= new Date();
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: c.openAt,
    createdAt: c.createdAt,
    inPlaza: !!c.inPlaza,
    favoriteCount: c.favoriteCount,
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
  // 校验 openAt > now + 60s 且 < now + 10 年
  const openAt = new Date(req.openAt);
  if (Number.isNaN(openAt.getTime())) throw ERR.validation("openAt 不是合法时间", "openAt");
  if (openAt.getTime() <= Date.now() + 60_000) {
    throw ERR.validation("开启时间至少需 60 秒后", "openAt");
  }
  const tenYearsMs = 10 * 365 * 24 * 3600 * 1000;
  if (openAt.getTime() > Date.now() + tenYearsMs) {
    throw ERR.validation("开启时间不能超过 10 年", "openAt");
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
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.capsules).where(eq(t.capsules.id, capsuleId)).limit(1);
  const c = rows[0];
  if (!c) throw ERR.notFound("胶囊不存在");
  if (c.ownerId !== userId) throw ERR.forbidden("无权删除他人胶囊");
  await db.delete(t.capsules).where(eq(t.capsules.id, capsuleId));
}
