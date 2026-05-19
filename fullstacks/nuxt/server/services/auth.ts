import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getCtx } from "~/server/db";
import { ERR } from "~/server/lib/errors";
import { env } from "~/server/lib/env";
import {
  createAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  verifyPassword,
} from "~/server/lib/security";
import { allowedAvatarIds } from "./avatars";
import type { UserOut, AuthTokens } from "~/types";

// 简单内存限流：邮箱 → 最近失败时间戳数组
// 挂到 globalThis 上，避免 Nuxt/Nitro 开发热更新重新加载模块时重置状态
declare global {
  // eslint-disable-next-line no-var
  var __helloTimeLoginFailures: Map<string, number[]> | undefined;
}
const loginFailures: Map<string, number[]> =
  globalThis.__helloTimeLoginFailures ?? (globalThis.__helloTimeLoginFailures = new Map());

function recordLoginFailure(email: string): void {
  const arr = loginFailures.get(email) ?? [];
  arr.push(Date.now());
  loginFailures.set(email, arr);
}

function checkLoginRate(email: string): void {
  const arr = (loginFailures.get(email) ?? []).filter((t) => Date.now() - t < 60_000);
  loginFailures.set(email, arr);
  if (arr.length >= env.loginRateLimitPerMinute) {
    throw ERR.rateLimited("登录尝试过于频繁，请稍后再试");
  }
}

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  avatarId: string;
  createdAt: string;
  updatedAt: string;
}

function userToDto(u: UserRow): UserOut {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    avatarId: u.avatarId,
    createdAt: u.createdAt,
  };
}

async function issueTokenPair(user: UserRow, familyId?: string): Promise<AuthTokens> {
  const { db, t } = await getCtx();
  const access = await createAccessToken({
    userId: user.id,
    nickname: user.nickname,
    avatarId: user.avatarId,
  });
  const raw = generateRefreshToken();
  const tokenHash = hashRefreshToken(raw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.refreshTokenTtlSeconds * 1000);
  await db.insert(t.refreshTokens).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash,
    familyId: familyId ?? randomUUID(),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    revokedAt: null,
  });
  return {
    accessToken: access.token,
    refreshToken: raw,
    accessTokenExpiresIn: access.expiresIn,
    refreshTokenExpiresIn: env.refreshTokenTtlSeconds,
    user: userToDto(user),
  };
}

export async function register(input: {
  email: string;
  password: string;
  nickname: string;
  avatarId: string;
}): Promise<AuthTokens> {
  if (!allowedAvatarIds().has(input.avatarId)) {
    throw ERR.validation("头像 ID 不存在", "avatarId");
  }
  const email = input.email.trim().toLowerCase();
  const { db, t } = await getCtx();

  const existsEmail = await db.select().from(t.users).where(eq(t.users.email, email)).limit(1);
  if (existsEmail[0]) throw ERR.conflict("邮箱已被注册", "email");
  const existsNick = await db
    .select()
    .from(t.users)
    .where(eq(t.users.nickname, input.nickname))
    .limit(1);
  if (existsNick[0]) throw ERR.conflict("昵称已被使用", "nickname");

  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  try {
    await db.insert(t.users).values({
      id,
      email,
      passwordHash,
      nickname: input.nickname,
      avatarId: input.avatarId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("email")) throw ERR.conflict("邮箱已被注册", "email");
    if (msg.includes("nickname")) throw ERR.conflict("昵称已被使用", "nickname");
    throw ERR.conflict("注册冲突");
  }
  const user: UserRow = {
    id,
    email,
    passwordHash,
    nickname: input.nickname,
    avatarId: input.avatarId,
    createdAt: now,
    updatedAt: now,
  };
  return issueTokenPair(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthTokens> {
  const email = input.email.trim().toLowerCase();
  checkLoginRate(email);
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.users).where(eq(t.users.email, email)).limit(1);
  const user = rows[0] as UserRow | undefined;
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    recordLoginFailure(email);
    throw ERR.unauthorized("邮箱或密码错误");
  }
  return issueTokenPair(user);
}

/*
 * 并发取舍说明（教学项目，见 docs/03-roadmap.md 的 M2 已知问题）
 *
 * 当前 refresh() 是「SELECT → 检查 revokedAt → UPDATE 旧 token → INSERT 新 token」
 * 四步非原子，和 Next.js 全栈实现保持同构。两个并发 refresh(同 rawToken)
 * 可能都读到 revokedAt=null，并各自签发一对新 token。
 *
 * 生产化做法：用条件 UPDATE + RETURNING 抢占旧 token：
 *   UPDATE refresh_tokens SET revoked_at = now()
 *    WHERE id = $1 AND revoked_at IS NULL
 *   RETURNING id;
 * rowCount=1 的请求继续签新 token；rowCount=0 的请求按重放处理并撤销 family。
 */
export async function refresh(rawToken: string): Promise<AuthTokens> {
  const tokenHash = hashRefreshToken(rawToken);
  const { db, t } = await getCtx();
  const rows = await db
    .select()
    .from(t.refreshTokens)
    .where(eq(t.refreshTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) throw ERR.unauthorized("refresh token 无效");

  const now = new Date();
  if (new Date(row.expiresAt) <= now) {
    throw ERR.unauthorized("refresh token 已过期");
  }
  if (row.revokedAt) {
    // 重放 → 整族作废
    await db
      .update(t.refreshTokens)
      .set({ revokedAt: now.toISOString() })
      .where(and(eq(t.refreshTokens.familyId, row.familyId), isNull(t.refreshTokens.revokedAt)));
    throw ERR.unauthorized("refresh token 已失效");
  }

  const userRows = await db.select().from(t.users).where(eq(t.users.id, row.userId)).limit(1);
  const user = userRows[0] as UserRow | undefined;
  if (!user) throw ERR.unauthorized("用户不存在");

  await db
    .update(t.refreshTokens)
    .set({ revokedAt: now.toISOString() })
    .where(eq(t.refreshTokens.id, row.id));

  return issueTokenPair(user, row.familyId);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  const { db, t } = await getCtx();
  const rows = await db
    .select()
    .from(t.refreshTokens)
    .where(eq(t.refreshTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt) return;
  await db
    .update(t.refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(t.refreshTokens.id, row.id));
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  const user = rows[0] as UserRow | undefined;
  if (!user) throw ERR.unauthorized();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ERR.unauthorized("当前密码错误");
  }
  const newHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await db
    .update(t.users)
    .set({ passwordHash: newHash, updatedAt: now })
    .where(eq(t.users.id, userId));
  // 撤销所有 refresh token
  await db
    .update(t.refreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(t.refreshTokens.userId, userId), isNull(t.refreshTokens.revokedAt)));
}
