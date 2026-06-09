/**
 * 服务端会话 cookie：让 React Server Component 能识别当前用户。
 *
 * 背景：SPA 客户端走 Authorization: Bearer（token 在内存/localStorage），服务端读不到。
 * 为支持 RSC 服务端取数（plaza / 胶囊详情等读页），登录/注册/刷新时额外写一枚 httpOnly
 * 的 access cookie；RSC 用它解析当前用户。/api/v1 的 Bearer 流程保持不变，契约与各 SPA
 * 前端不受影响（cookie 对它们是无副作用的附加项）。
 */
import "server-only";

import { cookies } from "next/headers";
import { decodeAccessToken } from "./security";

export const SESSION_COOKIE = "ht_session";

export interface ServerViewer {
  id: string;
  nickname: string;
  avatarId: string;
}

/** 写入会话 cookie（在 Route Handler 中调用）。 */
export async function setSessionCookie(accessToken: string, maxAgeSeconds: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
    secure: false, // 教学项目本地 http；生产应置 true
  });
}

/** 清除会话 cookie（登出时调用）。 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** RSC 中读取当前用户；无 cookie 或 token 失效返回 null（页面按匿名渲染）。 */
export async function getServerViewer(): Promise<ServerViewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = await decodeAccessToken(token);
    return { id: claims.sub, nickname: claims.nickname, avatarId: claims.avatarId };
  } catch {
    return null;
  }
}
