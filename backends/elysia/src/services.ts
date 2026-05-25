import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "./config";
import { dbKind, one, query, tx } from "./db";
import { ERR } from "./errors";
import { allowedAvatarIds } from "./avatars";
import {
  createAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  randomUUID,
  verifyPassword,
} from "./security";
import {
  bool,
  capsuleDetail,
  capsuleListItem,
  CapsuleRow,
  iso,
  OwnerBrief,
  pagination,
  UserRow,
  userDto,
} from "./types";

const loginFailures = new Map<string, number[]>();
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function code() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

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

async function findUserById(id: string) {
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

async function issueTokenPair(user: UserRow, familyId?: string) {
  const access = await createAccessToken({
    id: user.id,
    nickname: user.nickname,
    avatarId: user.avatarId,
  });
  const refreshToken = generateRefreshToken();
  const now = new Date();
  await query(
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
  // TODO: wrap the lookup → revoke → insert sequence in a transaction with a
  // SELECT FOR UPDATE (PG) / BEGIN IMMEDIATE (SQLite) to eliminate the TOCTOU
  // race where two concurrent requests with the same token both pass the
  // revoked-at check. Acceptable for a teaching project but would need fixing
  // in production.
  const tokenHash = hashRefreshToken(rawToken);
  const row = await one<{
    id: string;
    userId: string;
    familyId: string;
    expiresAt: string;
    revokedAt: string | null;
  }>(
    `SELECT id, user_id AS "userId", family_id AS "familyId", expires_at AS "expiresAt",
            revoked_at AS "revokedAt"
       FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );
  if (!row) throw ERR.unauthorized("refresh token 无效");
  const now = new Date();
  if (new Date(row.expiresAt) <= now) throw ERR.unauthorized("refresh token 已过期");
  if (row.revokedAt) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`,
      [now.toISOString(), row.familyId],
    );
    throw ERR.unauthorized("refresh token 已失效");
  }
  const user = await findUserById(row.userId);
  if (!user) throw ERR.unauthorized("用户不存在");
  await query(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`, [now.toISOString(), row.id]);
  return issueTokenPair(user, row.familyId);
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

function rowOwner(r: CapsuleRow & OwnerBrief): OwnerBrief {
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

function validatePage(page: number, pageSize: number) {
  if (!Number.isInteger(page) || page < 1) throw ERR.validation("page 必须 >= 1", "page");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw ERR.validation("pageSize 范围 1-50", "pageSize");
  }
}

async function favoriteSet(viewerId: string | null, ids: string[]) {
  if (!viewerId || ids.length === 0) return new Set<string>();
  const marks = ids.map(() => "?").join(",");
  const rows = await query<{ capsuleId: string }>(
    `SELECT capsule_id AS "capsuleId" FROM favorites
      WHERE user_id = ? AND capsule_id IN (${marks})`,
    [viewerId, ...ids],
  );
  return new Set(rows.map((r) => r.capsuleId));
}

export async function plazaList(opts: {
  sort: string;
  filter: string;
  q: string | null;
  page: number;
  pageSize: number;
  viewerId: string | null;
}) {
  if (!["hot", "new"].includes(opts.sort)) throw ERR.validation("sort 仅支持 hot/new", "sort");
  if (!["all", "opened", "unopened"].includes(opts.filter)) {
    throw ERR.validation("filter 仅支持 all/opened/unopened", "filter");
  }
  validatePage(opts.page, opts.pageSize);
  const q = (opts.q ?? "").trim();
  if (q.length > 50) throw ERR.validation("q 长度不得超过 50", "q");

  const where: string[] = ["c.in_plaza = ?"];
  const params: unknown[] = [true];
  const now = new Date().toISOString();
  if (opts.filter === "opened") {
    where.push("c.open_at <= ?");
    params.push(now);
  } else if (opts.filter === "unopened") {
    where.push("c.open_at > ?");
    params.push(now);
  }
  if (q) {
    where.push("(lower(c.title) LIKE ? OR lower(u.nickname) LIKE ?)");
    params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
  }
  const clause = where.join(" AND ");
  const order =
    opts.sort === "hot"
      ? "c.favorite_count DESC, c.created_at DESC"
      : "c.created_at DESC";
  const rows = await query<CapsuleRow & OwnerBrief>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.nickname, u.avatar_id AS "avatarId"
       FROM capsules c
       JOIN users u ON u.id = c.owner_id
      WHERE ${clause}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, (opts.page - 1) * opts.pageSize],
  );
  const count = await one<{ n: string | number }>(
    `SELECT count(*) AS n FROM capsules c JOIN users u ON u.id = c.owner_id WHERE ${clause}`,
    params,
  );
  const faved = await favoriteSet(opts.viewerId, rows.map((r) => r.id));
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), faved.has(r.id))),
    pagination: pagination(Number(count?.n ?? 0), opts.page, opts.pageSize),
  };
}

export async function myCapsules(userId: string, page: number, pageSize: number) {
  validatePage(page, pageSize);
  const count = await one<{ n: string | number }>(`SELECT count(*) AS n FROM capsules WHERE owner_id = ?`, [
    userId,
  ]);
  const rows = await query<CapsuleRow & OwnerBrief>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.nickname, u.avatar_id AS "avatarId"
       FROM capsules c
       JOIN users u ON u.id = c.owner_id
      WHERE c.owner_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), false)),
    pagination: pagination(Number(count?.n ?? 0), page, pageSize),
  };
}

export async function myFavorites(userId: string, page: number, pageSize: number) {
  validatePage(page, pageSize);
  const count = await one<{ n: string | number }>(`SELECT count(*) AS n FROM favorites WHERE user_id = ?`, [
    userId,
  ]);
  const rows = await query<CapsuleRow & OwnerBrief & { favoritedAt: string }>(
    `SELECT c.id, c.owner_id AS "ownerId", c.code, c.title, c.content,
            c.open_at AS "openAt", c.in_plaza AS "inPlaza",
            c.favorite_count AS "favoriteCount", c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            u.nickname, u.avatar_id AS "avatarId",
            f.created_at AS "favoritedAt"
       FROM favorites f
       JOIN capsules c ON c.id = f.capsule_id
       JOIN users u ON u.id = c.owner_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  return {
    items: rows.map((r) => capsuleListItem(r, rowOwner(r), true, iso(r.favoritedAt))),
    pagination: pagination(Number(count?.n ?? 0), page, pageSize),
  };
}

export async function addFavorite(userId: string, capsuleId: string) {
  return tx(async (q) => {
    const locking = (await dbKind()) === "postgres" ? " FOR UPDATE" : "";
    const capsules = await q<CapsuleRow>(
      `SELECT id, owner_id AS "ownerId", code, title, content, open_at AS "openAt",
              in_plaza AS "inPlaza", favorite_count AS "favoriteCount",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM capsules WHERE id = ?${locking}`,
      [capsuleId],
    );
    const capsule = capsules[0];
    if (!capsule || !bool(capsule.inPlaza)) throw ERR.notFound("胶囊不存在");
    if (capsule.ownerId === userId) throw ERR.badRequest("不能收藏自己创建的胶囊");

    const existing = await q<{ createdAt: string }>(
      `SELECT created_at AS "createdAt" FROM favorites WHERE user_id = ? AND capsule_id = ? LIMIT 1`,
      [userId, capsuleId],
    );
    if (existing[0]) {
      return {
        capsuleId,
        favoriteCount: Number(capsule.favoriteCount),
        favoritedAt: iso(existing[0].createdAt),
      };
    }
    const now = new Date().toISOString();
    await q(`INSERT INTO favorites (user_id, capsule_id, created_at) VALUES (?, ?, ?)`, [
      userId,
      capsuleId,
      now,
    ]);
    await q(`UPDATE capsules SET favorite_count = favorite_count + 1 WHERE id = ?`, [capsuleId]);
    const updated = await q<{ favoriteCount: number }>(
      `SELECT favorite_count AS "favoriteCount" FROM capsules WHERE id = ?`,
      [capsuleId],
    );
    return { capsuleId, favoriteCount: Number(updated[0]?.favoriteCount ?? 1), favoritedAt: now };
  });
}

export async function removeFavorite(userId: string, capsuleId: string) {
  await tx(async (q) => {
    const existing = await q(`SELECT 1 FROM favorites WHERE user_id = ? AND capsule_id = ? LIMIT 1`, [
      userId,
      capsuleId,
    ]);
    if (!existing[0]) return;
    await q(`DELETE FROM favorites WHERE user_id = ? AND capsule_id = ?`, [userId, capsuleId]);
    await q(
      `UPDATE capsules
          SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END
        WHERE id = ?`,
      [capsuleId],
    );
  });
}

function promptTemplate() {
  const path = join(process.cwd(), "..", "..", "spec", "llm", "capsule-suggestion.prompt.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return '基于标题 {TITLE} 生成中文时光胶囊正文，并返回 {"content":"...","openInDays":30}。';
}

function fallbackSuggestion(title: string) {
  const days = [30, 90, 180, 365][Math.floor(Math.random() * 4)];
  return {
    content:
      `写下《${title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。` +
      "如果一切顺利，就笑一笑；如果有些事没有按预期发生，也不必懊恼。记得照顾好自己，也记得对身边的人温柔一点。",
    days,
  };
}

export async function suggestCapsule(input: { title: string }) {
  const title = input.title.trim();
  let generatedBy = "local-template";
  let content = "";
  let days = 30;
  if (env.llm.enabled && env.llm.apiKey.trim()) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), env.llm.timeoutMs);
      const resp = await fetch(`${env.llm.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.llm.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.llm.model,
          messages: [
            { role: "system", content: "只返回严格 JSON，字段为 content 和 openInDays。" },
            { role: "user", content: promptTemplate().replace("{TITLE}", title) },
          ],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content ?? "";
      const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(jsonText) as { content?: unknown; openInDays?: unknown };
      content = String(parsed.content ?? "").trim().slice(0, 5000);
      days = Math.max(1, Math.min(3650, Math.floor(Number(parsed.openInDays ?? 30))));
      if (!content) throw new Error("empty content");
      generatedBy = `openai:${env.llm.model}`;
    } catch {
      const f = fallbackSuggestion(title);
      content = f.content;
      days = f.days;
    }
  } else {
    const f = fallbackSuggestion(title);
    content = f.content;
    days = f.days;
  }
  return {
    content,
    openInDays: days,
    openAt: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
    generatedBy,
    cached: false,
  };
}
