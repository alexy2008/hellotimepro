// ============================================================
// 内置头像：spec/avatars/v2（单线徽记，currentColor）。
// 徽记要内联进 DOM 才能被皮肤样式上色（<img> 里的 currentColor 只会是黑色）。
//
// React 参考前端在构建期用 import.meta.glob 把 SVG 内联进来；
// 这里换成 Next 的做法：根布局是 Server Component，在服务端读 spec/avatars/v2
// （lib/server/avatar-catalog.ts），把头像表作为 props 交给客户端根组件，
// 客户端在渲染任何页面之前调用 registerAvatars() 登记。
// ============================================================

export interface AvatarDef {
  id: string;
  name: string;
  tagline: string;
  color: string;
  /** 徽记的内层路径（不含外层 <svg> 与 <title>） */
  glyph: string;
}

export let AVATARS: AvatarDef[] = [];

const FALLBACK: AvatarDef = { id: "neo", name: "", tagline: "", color: "", glyph: "" };

export function registerAvatars(list: AvatarDef[]) {
  if (AVATARS.length === 0) AVATARS = list;
}

export const avatarOf = (id: string | null | undefined): AvatarDef =>
  AVATARS.find((a) => a.id === id) ?? AVATARS[0] ?? FALLBACK;
