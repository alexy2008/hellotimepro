import { withApi } from "@/lib/server/envelope";
import { getHealth } from "@/services/health";
import type { HealthData } from "@/types";

export async function GET() {
  return withApi<HealthData>(() => getHealth());
}

// 显式声明运行时（spec 要 Node API：fs 读 catalog 等）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
