/**
 * 从 H3Event 请求头读取 access token，解码并按需校验存在性。
 */
import type { H3Event } from "h3";
import { getHeader } from "h3";
import { eq } from "drizzle-orm";
import { getCtx } from "~/server/db";
import { decodeAccessToken, AccessTokenError } from "./security";
import { ERR } from "./errors";

export interface CurrentUserClaims {
  id: string;
  nickname: string;
  avatarId: string;
}

export async function readClaims(event: H3Event): Promise<CurrentUserClaims | null> {
  const auth = getHeader(event, "authorization");
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

export async function requireClaims(event: H3Event): Promise<CurrentUserClaims> {
  const c = await readClaims(event);
  if (!c) throw ERR.unauthorized("未登录");
  return c;
}

/** 加载完整 User 行（多数情况下 claims 即够用，需要 password_hash 等再调用此函数）。 */
export async function loadUserById(userId: string) {
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  return rows[0] ?? null;
}
