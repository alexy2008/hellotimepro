import { one, query } from "../db";
import { ERR } from "../errors";
import { randomUUID } from "../security";
import { bool, capsuleDetail, CapsuleRow, OwnerBrief } from "../types";
import { findUserById } from "./auth";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function code() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

async function capsuleWithOwnerBy(where: string, params: unknown[]) {
  return one<CapsuleRow & OwnerBrief>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.id AS "ownerIdJoined", u.nickname, u.avatar_id AS "avatarId"
       FROM capsules c
       JOIN users u ON u.id = c.owner_id
      WHERE ${where}
      LIMIT 1`,
    params,
  );
}

async function favorited(userId: string | null, capsuleId: string) {
  if (!userId) return false;
  const row = await one(`SELECT 1 FROM favorites WHERE user_id = ? AND capsule_id = ? LIMIT 1`, [
    userId,
    capsuleId,
  ]);
  return !!row;
}

export function rowOwner(r: CapsuleRow & OwnerBrief): OwnerBrief {
  return { id: r.ownerId, nickname: r.nickname, avatarId: r.avatarId };
}

export async function createCapsule(ownerId: string, req: {
  title: string;
  content: string;
  openAt: string;
  inPlaza?: boolean;
}) {
  const openAt = new Date(req.openAt);
  if (Number.isNaN(openAt.getTime())) throw ERR.validation("openAt 不是合法时间", "openAt");
  if (openAt.getTime() <= Date.now() + 60_000) throw ERR.validation("开启时间至少需 60 秒后", "openAt");
  if (openAt.getTime() > Date.now() + 10 * 365 * 24 * 3600 * 1000) {
    throw ERR.validation("开启时间不能超过 10 年", "openAt");
  }
  const owner = await findUserById(ownerId);
  if (!owner) throw ERR.unauthorized();
  let lastErr: unknown;
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const capsuleCode = code();
    try {
      await query(
        `INSERT INTO capsules
          (id, owner_id, code, title, content, open_at, in_plaza, favorite_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ownerId, capsuleCode, req.title, req.content, openAt.toISOString(), req.inPlaza ?? true, 0, now, now],
      );
      return capsuleDetail(
        {
          id,
          ownerId,
          code: capsuleCode,
          title: req.title,
          content: req.content,
          openAt: openAt.toISOString(),
          inPlaza: req.inPlaza ?? true,
          favoriteCount: 0,
          createdAt: now,
          updatedAt: now,
        },
        { id: owner.id, nickname: owner.nickname, avatarId: owner.avatarId },
        false,
      );
    } catch (e) {
      // Only retry on a code-uniqueness collision; rethrow anything else immediately.
      // PG:     duplicate key value violates unique constraint "capsules_code_uk"
      // SQLite: UNIQUE constraint failed: capsules.code
      const msg = e instanceof Error ? e.message : "";
      if (!/capsules_code_uk|capsules\.code/i.test(msg)) throw e;
      lastErr = e;
    }
  }
  throw ERR.internal(`生成唯一码失败：${lastErr instanceof Error ? lastErr.message : ""}`);
}

export async function getCapsuleByCode(codeParam: string, viewerId: string | null) {
  if (!/^[A-Za-z0-9]{8}$/.test(codeParam)) {
    throw ERR.validation("胶囊码格式错误（须 8 位字母或数字）", "code");
  }
  const row = await capsuleWithOwnerBy("c.code = ?", [codeParam.toUpperCase()]);
  if (!row) throw ERR.notFound("胶囊不存在");
  return capsuleDetail(row, rowOwner(row), await favorited(viewerId, row.id));
}

export async function getPlazaCapsuleById(id: string, viewerId: string | null) {
  const row = await capsuleWithOwnerBy("c.id = ? AND c.in_plaza = ?", [id, true]);
  if (!row) throw ERR.notFound("胶囊不存在");
  return capsuleDetail(row, rowOwner(row), await favorited(viewerId, row.id));
}

export async function deleteOwnCapsule(userId: string, capsuleId: string) {
  const c = await one<{ id: string; ownerId: string }>(
    `SELECT id, owner_id AS "ownerId" FROM capsules WHERE id = ? LIMIT 1`,
    [capsuleId],
  );
  if (!c) throw ERR.notFound("胶囊不存在");
  if (c.ownerId !== userId) throw ERR.forbidden("无权删除他人胶囊");
  await query(`DELETE FROM capsules WHERE id = ?`, [capsuleId]);
}
