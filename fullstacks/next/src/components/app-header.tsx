"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { avatarUrl } from "@/lib/avatar";
import { ThemeToggle } from "./theme-toggle";

function shortName(name: string): string {
  return Array.from(name).slice(0, 4).join("");
}

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 启动时一次性同步 /me（与 React App.tsx 顶层 hydrate 等价）
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsidePointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const navClass = (href: string, exact = false) =>
    (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"))
      ? "cy-nav__active"
      : undefined;

  const dropdownItemClass = (href: string) =>
    `cy-user-dropdown__item${pathname === href ? " is-active" : ""}`;

  return (
    <header className="cy-header">
      <div className="cy-container cy-header__inner">
        <Link href="/" className="cy-brand">
          <img className="cy-brand__mark" src="/logo.svg" width={38} height={38} alt="" />
          HelloTime<span className="cy-brand__pro">PRO</span>
        </Link>
        <nav className="cy-nav">
          <Link href="/" className={navClass("/", true)}>
            广场
          </Link>
          <Link href="/open" className={navClass("/open")}>
            开启
          </Link>
          <Link href="/about" className={navClass("/about")}>
            关于
          </Link>
        </nav>
        <div className="cy-header__actions">
          <ThemeToggle />
          {user ? (
            <div className="cy-user-menu" ref={menuRef}>
              <button
                type="button"
                className="cy-user-chip cy-user-chip--button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`${user.nickname} 的菜单`}
                title={user.nickname}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span title={user.nickname}>{shortName(user.nickname)}</span>
                <img src={avatarUrl(user.avatarId)} alt="" />
                <span className="cy-user-chip__chevron" aria-hidden="true">⌄</span>
              </button>
              {menuOpen && (
                <div className="cy-user-dropdown" role="menu">
                  <Link
                    href="/me/created"
                    role="menuitem"
                    className={dropdownItemClass("/me/created")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span aria-hidden="true">📝</span>
                    <span>我创建的</span>
                  </Link>
                  <Link
                    href="/me/favorites"
                    role="menuitem"
                    className={dropdownItemClass("/me/favorites")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span aria-hidden="true">♥</span>
                    <span>我收藏的</span>
                  </Link>
                  <Link
                    href="/me/profile"
                    role="menuitem"
                    className={dropdownItemClass("/me/profile")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span aria-hidden="true">⚙</span>
                    <span>账号设置</span>
                  </Link>
                  <span className="cy-user-dropdown__divider" />
                  <button
                    type="button"
                    className="cy-user-dropdown__item cy-user-dropdown__item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout().then(() => window.location.assign("/"));
                    }}
                  >
                    <span aria-hidden="true">↩</span>
                    <span>登出</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="cy-btn cy-btn--ghost cy-btn--sm">
                登录
              </Link>
              <Link href="/register" className="cy-btn cy-btn--primary cy-btn--sm">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
