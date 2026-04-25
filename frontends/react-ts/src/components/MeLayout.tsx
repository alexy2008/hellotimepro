import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

export function MeLayout() {
  const logout = useAuth((s) => s.logout);

  return (
    <>
      <AppHeader />
      <main className="cy-container">
        <div className="cy-me">
          <aside className="cy-me__nav">
            <NavLink to="/me/created" className={({ isActive }) => (isActive ? "is-active" : "")}>
              📝 我创建的
            </NavLink>
            <NavLink to="/me/favorites" className={({ isActive }) => (isActive ? "is-active" : "")}>
              ♥ 我收藏的
            </NavLink>
            <NavLink to="/me/profile" className={({ isActive }) => (isActive ? "is-active" : "")}>
              ⚙ 账号设置
            </NavLink>
            <span style={{ borderTop: "1px solid var(--color-border-subtle)", margin: "var(--space-3) 0" }} />
            <Link
              to="/login"
              onClick={(e) => {
                e.preventDefault();
                void logout().then(() => window.location.assign("/"));
              }}
              style={{ color: "var(--color-danger-fg)" }}
            >
              登出
            </Link>
          </aside>
          <section className="cy-me__content">
            <Outlet />
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
