import { useEffect, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { ThemeToggle } from "./ThemeToggle";
import { avatarUrl } from "@/utils/avatar";

function shortName(name: string): string {
  return Array.from(name).slice(0, 4).join("");
}

export function AppHeader() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="cy-header">
      <div className="cy-container cy-header__inner">
        <Link to="/" className="cy-brand">
          <img className="cy-brand__mark" src="/logo.svg" width={38} height={38} alt="" />
          HelloTime<span className="cy-brand__pro">PRO</span>
        </Link>
        <nav className="cy-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "cy-nav__active" : "")}>
            广场
          </NavLink>
          <NavLink to="/open" className={({ isActive }) => (isActive ? "cy-nav__active" : "")}>
            开启
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? "cy-nav__active" : "")}>
            关于
          </NavLink>
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
                  <NavLink
                    to="/me/created"
                    role="menuitem"
                    className={({ isActive }) =>
                      `cy-user-dropdown__item${isActive ? " is-active" : ""}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    <span aria-hidden="true">📝</span>
                    <span>我创建的</span>
                  </NavLink>
                  <NavLink
                    to="/me/favorites"
                    role="menuitem"
                    className={({ isActive }) =>
                      `cy-user-dropdown__item${isActive ? " is-active" : ""}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    <span aria-hidden="true">♥</span>
                    <span>我收藏的</span>
                  </NavLink>
                  <NavLink
                    to="/me/profile"
                    role="menuitem"
                    className={({ isActive }) =>
                      `cy-user-dropdown__item${isActive ? " is-active" : ""}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    <span aria-hidden="true">⚙</span>
                    <span>账号设置</span>
                  </NavLink>
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
              <Link to="/login" className="cy-btn cy-btn--ghost cy-btn--sm">
                登录
              </Link>
              <Link to="/register" className="cy-btn cy-btn--primary cy-btn--sm">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
