import { withApi } from "@/lib/server/envelope";
import { listAvatars } from "@/services/avatars";
import type { Avatar } from "@/types";

export async function GET() {
  return withApi<Avatar[]>(() => listAvatars());
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
