// ============================================================
// 「琥珀」外壳：悬浮胶囊顶栏 · 页脚 · 手机底栏
// 结构与类名照 2.0 原型 amber/shell.js；样式在 spec/styles/amber/components.css
// ============================================================

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@/lib/router";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { Avatar, FRONTEND_STACK, ROLE_LABEL, SkinSwitch, TechIcon, useHealth, useThemeToggle } from "@/components/shared";
import { UserMenu, navProps, useNavKey, useScrolled, type NavKey } from "@/components/shellParts";
import type { StackItem } from "@/types";
import { CreateLink } from "@/components/LoginPrompt";

/** 标志：一枚被时间轨道环绕的倾斜胶囊（插画固定配色，不随主题变） */
export function AmberLogo({ size = 34, className }: { size?: number; className?: string }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg className={className ? `logo ${className}` : "logo"} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${u}n`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34267e" />
          <stop offset="1" stopColor="#0a0e28" />
        </linearGradient>
        <linearGradient id={`${u}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe59a" />
          <stop offset=".5" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
        <linearGradient id={`${u}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#c9d1ff" />
        </linearGradient>
        <radialGradient id={`${u}w`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffb347" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${u}n)`} />
      <circle cx="32" cy="32" r="24" fill={`url(#${u}w)`} />
      <g transform="rotate(45 32 32)">
        <path d="M5 32A27 8 0 0 1 59 32" fill="none" stroke="#b9afff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1.5 3.4" />
        <path d="M22 32V22a10 10 0 0 1 20 0v10Z" fill={`url(#${u}a)`} />
        <path d="M22 32v10a10 10 0 0 0 20 0V32Z" fill={`url(#${u}g)`} />
        <rect x="26.5" y="35.5" width="11" height="10.5" rx="2" fill="#ffd98a" fillOpacity=".9" />
        <path d="M28.8 39h6.4M28.8 42h4.6" stroke="#b06a1c" strokeWidth="1.1" strokeLinecap="round" />
        <rect x="20.6" y="30.4" width="22.8" height="3.2" rx="1.6" fill="#1b1550" />
        <path d="M26.2 23a5.8 5.8 0 0 1 4.2-5.8" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round" />
        <path d="M5 32A27 8 0 0 0 59 32" fill="none" stroke="#d9d3ff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="51" cy="37.2" r="2.6" fill="#ffd27a" />
      </g>
      <path d="M13 43q.5 3.5 4 4-3.5.5-4 4-.5-3.5-4-4 3.5-.5 4-4Z" fill="#ffe59a" />
      <circle cx="50.5" cy="13.5" r="1.4" fill="#fff" fillOpacity=".9" />
      <circle cx="44" cy="8.5" r=".8" fill="#fff" fillOpacity=".6" />
    </svg>
  );
}

const NAV: Array<[Exclude<NavKey, null | "me">, string, string]> = [
  ["plaza", "/", "胶囊广场"],
  ["create", "/create", "写一枚"],
  ["open", "/open", "开启胶囊"],
  ["about", "/about", "关于"],
];

export function AmberHeader() {
  const user = useAuth((s) => s.user);
  const cur = useNavKey();
  const scrolled = useScrolled();
  const { theme, onClick } = useThemeToggle();
  const nav = useRef<HTMLElement>(null);
  const [ink, setInk] = useState<CSSProperties>({ opacity: 0 });
  const first = useRef(true);

  // 导航高亮底：跟着当前页滑过去（首次定位不带过渡）
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const a = nav.current?.querySelector<HTMLElement>(".nav__link.is-active");
      if (!a) return setInk({ opacity: 0 });
      setInk({
        opacity: 1,
        width: a.offsetWidth,
        transform: `translateX(${a.offsetLeft}px)`,
        transition: animate ? undefined : "none",
      });
    };
    place(!first.current);
    first.current = false;
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(() => place(false));
    return () => window.removeEventListener("resize", onResize);
  }, [cur, user]);

  return (
    <header className={`hdr${scrolled ? " is-scrolled" : ""}`}>
      <div className="hdr__bar">
        <Link className="brand" to="/" aria-label="HelloTime Pro 首页">
          <AmberLogo size={34} className="brand__logo" />
          <span className="brand__name">
            HelloTime<small>PRO</small>
          </span>
        </Link>
        <nav className="nav" ref={nav} aria-label="主导航">
          <span className="nav__ink" aria-hidden="true" style={ink} />
          {NAV.map(([k, to, label]) =>
            k === "create" ? (
              <CreateLink key={k} data-testid="nav-create" {...navProps(k, cur, "nav__link")}>
                {label}
              </CreateLink>
            ) : (
              <Link key={k} to={to} data-testid={`nav-${k}`} {...navProps(k, cur, "nav__link")}>
                {label}
              </Link>
            ),
          )}
        </nav>
        <div className="hdr__tools">
          <SkinSwitch />
          <button
            className="theme-toggle"
            type="button"
            role="switch"
            data-testid="theme-toggle"
            aria-checked={theme === "light"}
            aria-label={theme === "light" ? "当前为晨曦（亮色），切换到星夜" : "当前为星夜（暗色），切换到晨曦"}
            onClick={onClick}
          >
            <span className="theme-toggle__stars" />
            <span className="theme-toggle__cloud" />
            <span className="theme-toggle__knob" />
          </button>
          {user ? (
            <UserMenu createdIcon="feather" />
          ) : (
            <>
              <Link className="btn btn--ghost btn--sm hdr__login" to="/login" data-testid="nav-login">
                登录
              </Link>
              <Link className="btn btn--primary btn--sm" to="/register" data-testid="nav-register">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Chip({ it }: { it: StackItem }) {
  return (
    <span
      className="ftr__tech"
      title={`${ROLE_LABEL[it.role] ?? it.role} · ${it.name} ${it.version ?? ""}`}
      data-testid="stack-item"
      data-name={it.name}
    >
      <TechIcon item={it} className="tech-ic" />
      {it.name}
    </span>
  );
}

export function AmberFooter() {
  const { health, online } = useHealth();
  const backend = health?.stack.items ?? [];
  return (
    <footer className="ftr">
      <div className="ftr__in">
        <Link className="ftr__brand" to="/">
          <AmberLogo size={22} />
          HelloTime Pro · 时间胶囊
        </Link>
        <div className="ftr__stack" data-testid="footer-stack">
          <span className="ftr__dot" title={online === false ? "服务离线" : "服务在线"} data-online={online ?? undefined} />
          {FRONTEND_STACK.map((it) => (
            <Chip key={`f-${it.name}`} it={it} />
          ))}
          {backend.length ? <i className="ftr__x">×</i> : null}
          {backend.map((it) => (
            <Chip key={`b-${it.role}-${it.name}`} it={it} />
          ))}
        </div>
        <div className="ftr__meta">
          <span>把此刻，寄给未来</span>
          <span className="mono">v2.0</span>
        </div>
      </div>
    </footer>
  );
}

export function AmberTabBar() {
  const user = useAuth((s) => s.user);
  const cur = useNavKey();
  return (
    <nav className="tabbar" aria-label="主导航">
      <Link to="/" data-testid="tab-plaza" {...navProps("plaza", cur)}>
        <Icon name="grid" />
        <span>广场</span>
      </Link>
      <Link to="/open" data-testid="tab-open" {...navProps("open", cur)}>
        <Icon name="key" />
        <span>开启</span>
      </Link>
      <CreateLink data-testid="tab-create" {...navProps("create", cur, "tabbar__main")}>
        <i>
          <Icon name="pen" />
        </i>
        <span>写一枚</span>
      </CreateLink>
      <Link to={user ? "/me/created" : "/login"} data-testid="tab-me" {...navProps("me", cur)}>
        {user ? <Avatar id={user.avatarId} /> : <Icon name="user" />}
        <span>{user ? "我的" : "登录"}</span>
      </Link>
    </nav>
  );
}
