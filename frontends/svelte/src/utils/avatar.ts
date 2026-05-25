// 头像 URL 解析：优先用 catalog 中的 svgUrl（指向后端 /static/avatars/<id>.svg）
// 由 vite 代理转发到 :9080 → 当前后端

export function avatarUrl(avatarId: string | undefined | null): string {
  if (!avatarId) return "/static/avatars/neo.svg";
  return `/static/avatars/${avatarId}.svg`;
}
