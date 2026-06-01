import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "./config";
import { dbKind, one, query, tx } from "./db";
import { ERR } from "./errors";
import { generateRecommendations, generateSuggestion } from "./llm";
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

function suggestionPromptTemplate() {
  const path = join(process.cwd(), "..", "..", "spec", "llm", "capsule-suggestion.prompt.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return (
    "你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。" +
    "为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。" +
    '只返回严格 JSON：{"title":"...","content":"...","openInDays":30}。'
  );
}

function buildSuggestionPrompt(title: string) {
  return suggestionPromptTemplate().replace("{TITLE_OR_EMPTY}", title).replace("{TITLE}", title);
}

function coerceOpenInDays(raw: unknown): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : Math.floor(Number(raw));
  if (!Number.isFinite(n)) return NaN;
  return Math.max(1, Math.min(3650, n));
}

function cleanText(text: unknown, limit: number): string {
  let s = String(text ?? "").trim().replace(/[\r\n]+/g, " ");
  s = s.replace(/^[#*`　 "'《》【】]+|[#*`　 "'《》【】]+$/g, "").trim();
  return [...s].slice(0, limit).join("");
}

// 空标题模式下的本地兜底主题池：[title, content, openInDays]。
const FALLBACK_CAPSULES: Array<[string, string, number]> = [
  ["写给一个月后的自己",
    "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，" +
    "有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n" +
    "如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，" +
    "你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。", 30],
  ["下个季度想完成的一件事",
    "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。" +
    "现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n" +
    "等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。" +
    "无论结果如何，请记得为当初愿意开始的自己鼓一次掌。", 90],
  ["猜猜下届世界杯冠军是谁",
    "趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。" +
    "此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n" +
    "等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，" +
    "希望那段为热爱呐喊的日子，依然让你觉得值得。", 365],
  ["明年生日想对自己说的话",
    "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成" +
    "自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n" +
    "请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。", 365],
  ["三年后还在做喜欢的事吗",
    "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。" +
    "此刻它带给我很多快乐，也带来一些迷茫。\n\n" +
    "如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。" +
    "无论如何，别忘了当初让你眼睛发亮的那个瞬间。", 1095],
  ["五年后的我在哪座城市",
    "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？" +
    "此刻的我对未来有许多想象，也有一点不安。\n\n" +
    "等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。" +
    "不管落脚在哪，希望你过得踏实、自在。", 1825],
  ["十年后还在听同一首歌吗",
    "现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，" +
    "看看那时的你听到它，会想起什么。\n\n" +
    "十年很长，足够很多东西改变。但有些旋律会一直留在心里，" +
    "像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。", 3650],
];

// 返回 [title, content, openInDays]。
function fallbackSuggestion(autoTitle: boolean, title: string): [string, string, number] {
  if (autoTitle) {
    return FALLBACK_CAPSULES[Math.floor(Math.random() * FALLBACK_CAPSULES.length)];
  }
  const days = [30, 90, 180, 365][Math.floor(Math.random() * 4)];
  const content =
    `写下《${title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。` +
    "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n" +
    "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、" +
    "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n" +
    "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
  return [title, content, days];
}

export async function suggestCapsule(input: { title?: string }) {
  const title = (input.title ?? "").trim();
  const autoTitle = title === "";
  let generatedBy = "local-template";
  let resultTitle: string | undefined;
  let content = "";
  let days = 0;
  let ok = false;

  try {
    const result = await generateSuggestion(buildSuggestionPrompt(title));
    const text = String(result.content ?? "").trim().slice(0, 5000);
    const d = coerceOpenInDays(result.openInDays);
    if (!text || !Number.isFinite(d)) throw new Error("invalid LLM payload");
    let genTitle: string | undefined;
    if (autoTitle) {
      genTitle = cleanText(result.title, 60);
      if (!genTitle) throw new Error("empty title in auto-title mode");
    }
    content = text;
    days = d;
    if (autoTitle) resultTitle = genTitle;
    generatedBy = `${env.llm.provider}:${env.llm.model}`;
    ok = true;
  } catch (e) {
    console.warn(`Capsule suggestion LLM failed; using local fallback: ${e}`);
  }

  if (!ok) {
    const [fbTitle, fbContent, fbDays] = fallbackSuggestion(autoTitle, title);
    content = fbContent;
    days = fbDays;
    if (autoTitle) resultTitle = fbTitle;
  }

  return {
    ...(resultTitle ? { title: resultTitle } : {}),
    content,
    openInDays: days,
    openAt: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
    generatedBy,
    cached: false,
  };
}

// ---------- 胶囊推荐主题 ----------

function recommendationPromptTemplate() {
  const path = join(process.cwd(), "..", "..", "spec", "llm", "capsule-recommendation.prompt.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return (
    "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。" +
    "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。" +
    '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。'
  );
}

function parseRecommendationItems(raw: unknown): Array<{ title: string; hint: string; openInDays: number }> {
  const items: Array<{ title: string; hint: string; openInDays: number }> = [];
  if (!Array.isArray(raw)) return items;
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const title = cleanText(e.title, 60);
    const hint = cleanText(e.hint, 80);
    const d = coerceOpenInDays(e.openInDays);
    if (!title || !hint || !Number.isFinite(d) || seen.has(title)) continue;
    seen.add(title);
    items.push({ title, hint, openInDays: d });
  }
  return items;
}

// 推荐为锦上添花：LLM 不可用时返回空列表，不本地兜底、不报错。
export async function getCapsuleRecommendations(count: number) {
  const n = Math.min(8, Math.max(3, count));
  let items: Array<{ title: string; hint: string; openInDays: number }> = [];
  try {
    const result = await generateRecommendations(recommendationPromptTemplate().replace("{COUNT}", String(n)));
    items = parseRecommendationItems(result.items).slice(0, n);
  } catch (e) {
    console.log(`Capsule recommendations unavailable; returning empty list: ${e}`);
  }
  return {
    items,
    generatedBy: items.length > 0 ? `${env.llm.provider}:${env.llm.model}` : "none",
    cached: false,
  };
}
