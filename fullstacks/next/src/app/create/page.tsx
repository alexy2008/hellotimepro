// /create · 写一枚胶囊（需登录）
import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { CreatePage } from "@/views/CreatePage";

export const metadata: Metadata = { title: "写给未来 · HelloTime Pro" };

export default function Page() {
  return (
    <AuthGate>
      <CreatePage />
    </AuthGate>
  );
}
