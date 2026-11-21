// ============================================================
// 外壳里两套皮肤共用的逻辑：当前导航项、用户菜单。
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { useAuth } from "@/stores/auth";
import { toast } from "@/stores/feedback";
import { Icon, type IconName } from "@/lib/icons";
import { Avatar } from "@/components/shared";

export type NavKey = "plaza" | "open" | "create" | "about" | "me" | null;

/** 当前路由属于哪个导航项：详情页归在「开启」下，登录注册归在「我的」下 */
export function useNavKey(): NavKey {
  const { pathname } = useLocation();
  if (pathname === "/") return "plaza";
  if (pathname === "/open" || pathname.startsWith("/capsules/")) return "open";
  if (pathname === "/create") return "create";
  if (pathname === "/about") return "about";
  if (pathname.startsWith("/me") || pathname === "/login" || pathname === "/register") return "me";
  return null;
}

/** 导航链接的公共属性：高亮类名 + aria-current */
export function navProps(key: NavKey, cur: NavKey, base = "") {
  const on = key === cur;
  return {
    className: [base, on ? "is-active" : ""].filter(Boolean).join(" ") || undefined,
    "aria-current": on ? ("page" as const) : undefined,
  };
}

/** 页头滚动后加 is-scrolled（细线 / 描边由皮肤样式决定） */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return scrolled;
}

/** 已登录时页头右侧的头像菜单。icons：两套皮肤给「我创建的」配的图标不同 */
export function UserMenu({ createdIcon }: { createdIcon: IconName }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className={`umenu${open ? " is-open" : ""}`} ref={box}>
      <button
        className="uchip"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.nickname} 的菜单`}
        data-testid="user-menu"
        data-nickname={user.nickname}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar id={user.avatarId} />
        <span className="uchip__n">{user.nickname}</span>
        <Icon name="chev-down" className="ic--chev" />
      </button>
      <div className="umenu__pop" role="menu">
        <div className="umenu__who">
          <Avatar id={user.avatarId} className="av--lg" />
          <div>
            <b>{user.nickname}</b>
            <span className="mono">{user.email}</span>
          </div>
        </div>
        <Link role="menuitem" to="/me/created" data-testid="menu-created">
          <Icon name={createdIcon} />
          我创建的
        </Link>
        <Link role="menuitem" to="/me/favorites" data-testid="menu-favorites">
          <Icon name="heart" />
          我收藏的
        </Link>
        <Link role="menuitem" to="/me/profile" data-testid="menu-profile">
          <Icon name="sliders" />
          账号设置
        </Link>
        <hr />
        <button
          role="menuitem"
          type="button"
          data-testid="logout"
          onClick={async () => {
            setOpen(false);
            await logout(true);
            toast("已登出");
            navigate("/");
          }}
        >
          <Icon name="logout" />
          登出
        </button>
      </div>
    </div>
  );
}
