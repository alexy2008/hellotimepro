import { env } from "../config";
import { dbKind, one, query, tx } from "../db";
import { ERR } from "../errors";
import { allowedAvatarIds } from "../avatars";
import {
  createAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  randomUUID,
  verifyPassword,
} from "../security";
import { UserRow, userDto } from "../types";

const loginFailures = new Map<string, number[]>();
function checkLoginRate(email: string) {
  const failures = (loginFailures.get(email) ?? []).filter((t) => Date.now() - t < 60_000);
  loginFailures.set(email, failures);
  if (failures.length >= env.loginRateLimitPerMinute) {
    throw ERR.rateLimited("登录尝试过于频繁，请稍后再试");
  }
}

function recordFailure(email: string) {
  const failures = loginFailures.get(email) ?? [];
  failures.push(Date.now());
  loginFailures.set(email, failures);
}

export async function findUserById(id: string) {
  return one<UserRow>(
    `SELECT id, email, password_hash AS "passwordHash", nickname, avatar_id AS "avatarId",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
}

async function findUserByEmail(email: string) {
  return one<UserRow>(
    `SELECT id, email, password_hash AS "passwordHash", nickname, avatar_id AS "avatarId",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
}

async function issueTokenPair(user: UserRow, familyId?: string, q: typeof query = query) {
  const access = await createAccessToken({
    id: user.id,
    nickname: user.nickname,
    avatarId: user.avatarId,
  });
  const refreshToken = generateRefreshToken();
  const now = new Date();
  await q(
    `INSERT INTO refresh_tokens
       (id, user_id, token_hash, family_id, expires_at, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      user.id,
      hashRefreshToken(refreshToken),
      familyId ?? randomUUID(),
      new Date(now.getTime() + env.refreshTokenTtlSeconds * 1000).toISOString(),
      now.toISOString(),
      null,
    ],
  );
  return {
    accessToken: access.token,
    refreshToken,
    accessTokenExpiresIn: access.expiresIn,
    refreshTokenExpiresIn: env.refreshTokenTtlSeconds,
    user: userDto(user),
  };
}

export async function register(input: {
  email: string;
  password: string;
  nickname: string;
  avatarId: string;
}) {
  if (!allowedAvatarIds().has(input.avatarId)) throw ERR.validation("头像 ID 不存在", "avatarId");
  const email = input.email.trim().toLowerCase();
  if (await findUserByEmail(email)) throw ERR.conflict("邮箱已被注册", "email");
  const nick = await one(`SELECT id FROM users WHERE nickname = ? LIMIT 1`, [input.nickname]);
  if (nick) throw ERR.conflict("昵称已被使用", "nickname");

  const now = new Date().toISOString();
  const user: UserRow = {
    id: randomUUID(),
    email,
    passwordHash: await hashPassword(input.password),
    nickname: input.nickname,
    avatarId: input.avatarId,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await query(
      `INSERT INTO users (id, email, password_hash, nickname, avatar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.passwordHash, user.nickname, user.avatarId, now, now],
    );
  } catch (e) {
    // Match against explicit index names (predictable in both PG and SQLite).
    // PG:     duplicate key value violates unique constraint "users_email_uk"
    // SQLite: UNIQUE constraint failed: users.email
    const msg = e instanceof Error ? e.message : "";
    if (/users_email_uk|users\.email/i.test(msg)) throw ERR.conflict("邮箱已被注册", "email");
    if (/users_nickname_uk|users\.nickname/i.test(msg)) throw ERR.conflict("昵称已被使用", "nickname");
    throw e;
  }
  return issueTokenPair(user);
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  checkLoginRate(email);
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    recordFailure(email);
    throw ERR.unauthorized("邮箱或密码错误");
  }
  return issueTokenPair(user);
}

export async function refresh(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  const locking = (await dbKind()) === "postgres" ? " FOR UPDATE" : "";
  const outcome = await tx(async (q) => {
    const rows = await q<{
      id: string;
      userId: string;
      familyId: string;
      expiresAt: string;
      revokedAt: string | null;
    }>(
      `SELECT id, user_id AS "userId", family_id AS "familyId", expires_at AS "expiresAt",
              revoked_at AS "revokedAt"
         FROM refresh_tokens WHERE token_hash = ? LIMIT 1${locking}`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) return { ok: false as const, error: ERR.unauthorized("refresh token 无效") };

    const now = new Date();
    if (new Date(row.expiresAt) <= now) {
      return { ok: false as const, error: ERR.unauthorized("refresh token 已过期") };
    }

    if (row.revokedAt) {
      await q(
        `UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`,
        [now.toISOString(), row.familyId],
      );
      return { ok: false as const, error: ERR.unauthorized("refresh token 已失效") };
    }

    const user = await findUserById(row.userId);
    if (!user) return { ok: false as const, error: ERR.unauthorized("用户不存在") };

    await q(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`, [now.toISOString(), row.id]);
    return { ok: true as const, tokens: await issueTokenPair(user, row.familyId, q) };
  });

  if (!outcome.ok) throw outcome.error;
  return outcome.tokens;
}

export async function logout(rawToken?: string) {
  if (!rawToken) return;
  await query(
    `UPDATE refresh_tokens SET revoked_at = ?
      WHERE token_hash = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), hashRefreshToken(rawToken)],
  );
}

export async function getMe(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw ERR.unauthorized();
  return userDto(user);
}

export async function updateProfile(userId: string, patch: { nickname?: string; avatarId?: string }) {
  const user = await findUserById(userId);
  if (!user) throw ERR.unauthorized();
  const next = { nickname: user.nickname, avatarId: user.avatarId };
  if (patch.nickname && patch.nickname !== user.nickname) {
    const dup = await one<{ id: string }>(`SELECT id FROM users WHERE nickname = ? LIMIT 1`, [
      patch.nickname,
    ]);
    if (dup && dup.id !== userId) throw ERR.conflict("昵称已被使用", "nickname");
    next.nickname = patch.nickname;
  }
  if (patch.avatarId && patch.avatarId !== user.avatarId) {
    if (!allowedAvatarIds().has(patch.avatarId)) throw ERR.validation("头像 ID 不存在", "avatarId");
    next.avatarId = patch.avatarId;
  }
  if (next.nickname === user.nickname && next.avatarId === user.avatarId) return userDto(user);
  const now = new Date().toISOString();
  await query(`UPDATE users SET nickname = ?, avatar_id = ?, updated_at = ? WHERE id = ?`, [
    next.nickname,
    next.avatarId,
    now,
    userId,
  ]);
  return userDto({ ...user, ...next, updatedAt: now });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await findUserById(userId);
  if (!user) throw ERR.unauthorized();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ERR.unauthorized("当前密码错误");
  }
  const now = new Date().toISOString();
  await query(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    await hashPassword(newPassword),
    now,
    userId,
  ]);
  await query(`UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [
    now,
    userId,
  ]);
}
