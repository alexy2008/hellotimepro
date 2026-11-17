// ============================================================
// 登录回跳：需要登录时去 /login?redirect=<站内路径>，登录 / 注册成功后跳回。
// 只接受以单个 / 开头的站内路径，拒绝 //evil.com、http: 等，防止开放重定向。
// ============================================================

export function safeRedirect(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export const loginPath = (from: string) => `/login?redirect=${encodeURIComponent(from)}`;
