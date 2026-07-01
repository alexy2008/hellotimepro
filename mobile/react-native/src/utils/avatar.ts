// 头像 URL 解析：指向当前后端 /static/avatars/<id>.svg。
// 与 Web 版差异：RN 无 Vite 代理，需拼接绝对地址（API_BASE）。
// 渲染用 react-native-svg 的 SvgUri（远端 SVG）。

import { API_BASE } from "@/api/config";

export function avatarUrl(avatarId: string | undefined | null): string {
  const id = avatarId || "neo";
  return `${API_BASE}/static/avatars/${id}.svg`;
}

/** 技术栈 / 品牌图标：后端 /static/icons/<name>.svg。 */
export function iconUrl(name: string): string {
  return `${API_BASE}/static/icons/${name}.svg`;
}
