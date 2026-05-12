/**
 * 从请求头读取 access token，解码并按需校验存在性。
 */
import "server-only";

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getCtx } from "@/db";
import { decodeAccessToken, AccessTokenError } from "./security";
import { ERR } from "./errors";

export interface CurrentUserClaims {
  id: string;
  nickname: string;
  avatarId: string;
}

export async function readClaims(req: NextRequest | Request): Promise<CurrentUserClaims | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const claims = await decodeAccessToken(token);
    return { id: claims.sub, nickname: claims.nickname, avatarId: claims.avatarId };
  } catch (e) {
    if (e instanceof AccessTokenError && e.reason === "access_token_expired") {
      throw ERR.unauthorized("access_token_expired");
    }
    throw ERR.unauthorized("invalid_token");
  }
}

export async function requireClaims(req: NextRequest | Request): Promise<CurrentUserClaims> {
  const c = await readClaims(req);
  if (!c) throw ERR.unauthorized("未登录");
  return c;
}

/** 加载完整 User 行（多数情况下 claims 即够用，需要 password_hash 等再调用此函数）。 */
export async function loadUserById(userId: string) {
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  return rows[0] ?? null;
}
