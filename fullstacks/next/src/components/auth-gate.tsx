"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * 路由守卫：未登录跳到 /login，并把当前 URL 放到 ?next= 以便登录后回跳。
 * 与 React 端 AuthGate 行为对齐：有 user 直接通过；只有 refreshToken（刷新页未拿到 access）也允许进入，
 * 接口调用会自动 refresh。
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const pathname = usePathname();

  const allowed = !!user || !!refreshToken;

  useEffect(() => {
    if (isHydrated && !allowed) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [isHydrated, allowed, pathname, router]);

  if (!isHydrated) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
