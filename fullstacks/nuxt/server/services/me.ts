import { eq } from "drizzle-orm";
import { getCtx } from "~/server/db";
import { ERR } from "~/server/lib/errors";
import { allowedAvatarIds } from "./avatars";
import type { UserOut, UpdateProfileRequest } from "~/types";

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  avatarId: string;
  createdAt: string;
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

export async function getMe(userId: string): Promise<UserOut> {
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  const user = rows[0] as UserRow | undefined;
  if (!user) throw ERR.unauthorized();
  return userToDto(user);
}

export async function updateProfile(
  userId: string,
  patch: UpdateProfileRequest,
): Promise<UserOut> {
  const { db, t } = await getCtx();
  const rows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
  const user = rows[0] as UserRow | undefined;
  if (!user) throw ERR.unauthorized();

  const updates: Partial<{ nickname: string; avatarId: string; updatedAt: string }> = {};
  if (patch.nickname && patch.nickname !== user.nickname) {
    const dup = await db
      .select()
      .from(t.users)
      .where(eq(t.users.nickname, patch.nickname))
      .limit(1);
    if (dup[0] && dup[0].id !== userId) throw ERR.conflict("昵称已被使用", "nickname");
    updates.nickname = patch.nickname;
  }
  if (patch.avatarId && patch.avatarId !== user.avatarId) {
    if (!allowedAvatarIds().has(patch.avatarId)) {
      throw ERR.validation("头像 ID 不存在", "avatarId");
    }
    updates.avatarId = patch.avatarId;
  }
  if (Object.keys(updates).length === 0) return userToDto(user);
  updates.updatedAt = new Date().toISOString();
  await db.update(t.users).set(updates).where(eq(t.users.id, userId));
  return userToDto({ ...user, ...updates });
}
