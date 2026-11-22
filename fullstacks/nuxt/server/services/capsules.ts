import { randomInt, randomUUID } from "node:crypto";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { getCtx, withCapsuleTransaction } from "~/server/db";
import { ERR } from "~/server/lib/errors";
import { capsuleIds, dashed, iso } from "~/server/lib/records";
import { addCalendarYears } from "~/lib/fmt";
import { lockCapsule } from "./capsule-lock";
import type { CapsuleDetail, CreateCapsuleRequest } from "~/types";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
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
  const nowMs = Date.now();
  const openAt = new Date(req.openAt);
  if (Number.isNaN(openAt.getTime())) throw ERR.validation("openAt 不是合法时间", "openAt");
  if (openAt.getTime() <= nowMs + 60_000) throw ERR.validation("开启时间至少需 60 秒后", "openAt");
  if (openAt.getTime() > addCalendarYears(nowMs, 10)) {
    throw ERR.validation("开启时间不能超过 10 年", "openAt");
  }

  const { db, t } = await getCtx();
  const ownerRows = await db.select().from(t.users).where(eq(t.users.id, ownerId)).limit(1);
  const owner = ownerRows[0] as UserRow | undefined;
  if (!owner) throw ERR.unauthorized();

  const now = new Date(nowMs).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [capsule] = await db.insert(t.capsules).values({
      id: randomUUID(),
      ownerId,
      code: generateCode(),
      title: req.title,
      content: req.content,
      openAt: openAt.toISOString(),
      inPlaza: req.inPlaza ?? true,
      favoriteCount: 0,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing({ target: t.capsules.code }).returning();
    if (capsule) return toDetail(capsule, owner, false);
  }
  throw ERR.internal("生成唯一码失败");
}

export async function getCapsuleByCode(
  code: string,
  viewerId: string | null,
): Promise<CapsuleDetail> {
  if (!/^[A-Za-z0-9]{8}$/.test(code)) {
    throw ERR.validation("胶囊码格式错误（须 8 位字母或数字）", "code");
  }
  return getDetail((t) => eq(t.capsules.code, code.toUpperCase()), viewerId);
}

export function getPlazaDetail(id: string, viewerId: string | null) {
  return getDetail((t, kind) => and(
    inArray(t.capsules.id, capsuleIds(id, kind, "id")),
    eq(t.capsules.inPlaza, true),
  )!, viewerId);
}

async function getDetail(
  where: (t: Awaited<ReturnType<typeof getCtx>>["t"], kind: "postgres" | "sqlite") => SQL,
  viewerId: string | null,
) {
  const { db, t, kind } = await getCtx();
  const rows = await db
    .select({
      capsule: t.capsules,
      owner: { id: t.users.id, nickname: t.users.nickname, avatarId: t.users.avatarId },
    })
    .from(t.capsules)
    .innerJoin(t.users, eq(t.capsules.ownerId, t.users.id))
    .where(where(t, kind))
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
  return toDetail(row.capsule, row.owner, favoritedByMe);
}

export function deleteOwnCapsule(userId: string, id: string): Promise<void> {
  return withCapsuleTransaction(async (ctx) => {
    const { db, t } = ctx;
    const capsule = await lockCapsule(ctx, id, "id");
    if (!capsule) throw ERR.notFound("胶囊不存在");
    if (capsule.ownerId !== userId) throw ERR.forbidden("无权删除他人胶囊");
    await db.delete(t.favorites).where(eq(t.favorites.capsuleId, capsule.id));
    await db.delete(t.capsules).where(eq(t.capsules.id, capsule.id));
  });
}
