// /me/:tab · 我的（created / favorites / profile，需登录）
import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { MePage } from "@/views/MePage";

export const metadata: Metadata = { title: "我的 · HelloTime Pro" };

export default function Page() {
  return (
    <AuthGate>
      <MePage />
    </AuthGate>
  );
}
