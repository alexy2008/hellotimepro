// ============================================================
// 公开页的服务端取数：page.tsx / generateMetadata（Server Component）直接调用 services，
// 不绕 /api/v1 走一圈 HTTP。一律以匿名身份查询——令牌在浏览器 localStorage 里，
// 服务端看不到；收藏状态等个人投影由客户端水合后补齐。
//
// React cache()：同一次请求里 generateMetadata 与 page 各调一次，只查一次库。
// ============================================================
import "server-only";

import { cache } from "react";
import { plazaList, plazaStats } from "@/services/plaza";
import { getCapsuleByCode } from "@/services/capsules";
import { getHealth } from "@/services/health";
import { isApiError } from "@/lib/server/errors";
import type { CapsuleSeed, HealthData, PlazaSeed } from "@/types";

/** 与客户端广场 store 的默认查询一致（stores/plaza.ts） */
export const PLAZA_DEFAULT = { sort: "new", filter: "all", q: "", page: 1, pageSize: 9 } as const;

/** 首页第一屏；任何一项失败就整体不给，交给客户端按原逻辑请求并显示错误 / 重试 */
export async function loadPlazaSeed(): Promise<PlazaSeed | null> {
  const generatedAt = Date.now();
  try {
    const [list, overview, featured] = await Promise.all([
      plazaList({ ...PLAZA_DEFAULT, q: null, viewerId: null }),
      plazaStats(null),
      plazaList({ sort: "hot", filter: "unopened", q: null, page: 1, pageSize: 1, viewerId: null }),
    ]);
    return {
      ...PLAZA_DEFAULT,
      generatedAt,
      items: list.items,
      pagination: list.pagination,
      // 没有搜索词时，筛选数量（带 q 的统计）与年鉴（不带 q）是同一份
      counts: overview.counts,
      overview,
      featured: featured.items[0] ?? null,
    };
  } catch (e) {
    console.warn("[ssr] plaza seed failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** 胶囊详情第一屏：查到 → ok；查无此码 → missing；码格式错误或其他失败 → null（客户端照旧请求） */
export const loadCapsuleSeed = cache(async (code: string): Promise<CapsuleSeed | null> => {
  try {
    return { code, status: "ok", capsule: await getCapsuleByCode(code, null) };
  } catch (e) {
    if (isApiError(e) && e.status === 404) return { code, status: "missing" };
    return null;
  }
});

/** /health 的数据（不查库）：页脚与关于页共用 */
export const loadHealth = cache((): HealthData => getHealth());
