"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { AuthGate } from "@/components/auth-gate";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  const navClass = (href: string) => (pathname === href ? "is-active" : undefined);

  return (
    <AuthGate>
      <main className="cy-container">
        <div className="cy-me">
          <aside className="cy-me__nav">
            <Link href="/me/created" className={navClass("/me/created")}>
              📝 我创建的
            </Link>
            <Link href="/me/favorites" className={navClass("/me/favorites")}>
              ♥ 我收藏的
            </Link>
            <Link href="/me/profile" className={navClass("/me/profile")}>
              ⚙ 账号设置
            </Link>
            <span
              style={{
                borderTop: "1px solid var(--color-border-subtle)",
                margin: "var(--space-3) 0",
              }}
            />
            <Link
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                void logout().then(() => window.location.assign("/"));
              }}
              style={{ color: "var(--color-danger-fg)" }}
            >
              登出
            </Link>
          </aside>
          <section className="cy-me__content">{children}</section>
        </div>
      </main>
    </AuthGate>
  );
}
