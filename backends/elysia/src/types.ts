export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  avatarId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CapsuleRow {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  content: string;
  openAt: string;
  inPlaza: boolean | number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerBrief {
  id: string;
  nickname: string;
  avatarId: string;
}

export function userDto(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    avatarId: u.avatarId,
    createdAt: iso(u.createdAt),
  };
}

export function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function bool(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function capsuleDetail(
  c: CapsuleRow,
  owner: OwnerBrief,
  favoritedByMe: boolean,
) {
  const opened = new Date(c.openAt) <= new Date();
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: iso(c.openAt),
    createdAt: iso(c.createdAt),
    inPlaza: bool(c.inPlaza),
    favoriteCount: Number(c.favoriteCount),
    isOpened: opened,
    content: opened ? c.content : null,
    favoritedByMe,
  };
}

export function capsuleListItem(
  c: CapsuleRow,
  owner: OwnerBrief,
  favoritedByMe: boolean,
  favoritedAt: string | null = null,
) {
  const opened = new Date(c.openAt) <= new Date();
  const trimmed = c.content.trim();
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    creator: { nickname: owner.nickname, avatarId: owner.avatarId },
    openAt: iso(c.openAt),
    createdAt: iso(c.createdAt),
    inPlaza: bool(c.inPlaza),
    favoriteCount: Number(c.favoriteCount),
    isOpened: opened,
    favoritedByMe,
    favoritedAt,
    contentPreview: opened ? (trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed) : null,
  };
}

export function pagination(total: number, page: number, pageSize: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize ? Math.ceil(total / pageSize) : 0,
  };
}
