// 头像 URL 解析：优先用 catalog 中的 svgUrl（指向后端 /static/avatars/<id>.svg）

export function avatarUrl(avatarId: string | undefined | null): string {
  if (!avatarId) return "/static/avatars/neo.svg";
  return `/static/avatars/${avatarId}.svg`;
}
