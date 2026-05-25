import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { env } from "./config";
import { ApiError, ERR } from "./errors";

const secret = new TextEncoder().encode(env.jwtSecret);

export interface Claims {
  id: string;
  nickname: string;
  avatarId: string;
}

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(env.bcryptRounds);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hashed: string) {
  try {
    return await bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
}

export async function createAccessToken(user: Claims) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.accessTokenTtlSeconds;
  const token = await new SignJWT({ nickname: user.nickname, avatarId: user.avatarId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);
  return { token, expiresIn: env.accessTokenTtlSeconds };
}

function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

async function verifyToken(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("missing sub");
  return {
    id: payload.sub,
    nickname: String(payload.nickname ?? ""),
    avatarId: String(payload.avatarId ?? ""),
  };
}

/**
 * Optional auth — for public endpoints that show extra info when logged in.
 * Never throws: missing / expired / invalid tokens all return null.
 */
export async function readClaims(headers: Headers): Promise<Claims | null> {
  const token = extractBearerToken(headers);
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Required auth — for protected endpoints.
 * Throws 401 with a specific message for expired vs. invalid tokens.
 */
export async function requireClaims(headers: Headers): Promise<Claims> {
  const token = extractBearerToken(headers);
  if (!token) throw ERR.unauthorized("未登录");
  try {
    return await verifyToken(token);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const msg = e instanceof Error ? e.message : "";
    if (/expired/i.test(msg)) throw ERR.unauthorized("access_token_expired");
    throw ERR.unauthorized("invalid_token");
  }
}

export function generateRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(raw: string) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export { randomUUID };
