/**
 * 鉴权原语：bcrypt 密码哈希 + JWT access token + 不透明 refresh token。
 *
 * 与 FastAPI 参考实现的行为对齐：
 * - access token：JWT HS256，1h，payload 含 sub/nickname/avatarId/iat/exp
 * - refresh token：256-bit 随机 → base64url（不透明），DB 存 sha256
 */
import "server-only";

import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

const secret = new TextEncoder().encode(env.jwtSecret);

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(env.bcryptRounds);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
}

export interface AccessTokenClaims {
  sub: string;
  nickname: string;
  avatarId: string;
  iat: number;
  exp: number;
}

export async function createAccessToken(payload: {
  userId: string;
  nickname: string;
  avatarId: string;
}): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.accessTokenTtlSeconds;
  const token = await new SignJWT({
    nickname: payload.nickname,
    avatarId: payload.avatarId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);
  return { token, expiresIn: env.accessTokenTtlSeconds };
}

export class AccessTokenError extends Error {
  reason: "access_token_expired" | "invalid_token";
  constructor(reason: "access_token_expired" | "invalid_token") {
    super(reason);
    this.reason = reason;
  }
}

export async function decodeAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload as unknown as AccessTokenClaims;
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/expired/i.test(msg)) throw new AccessTokenError("access_token_expired");
    throw new AccessTokenError("invalid_token");
  }
}

// ---------- Refresh Token ----------
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
