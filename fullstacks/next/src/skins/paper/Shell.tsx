// ============================================================
// 「时笺」外壳：页头 · 页脚（技术栈题记）· 手机底栏
// 结构与类名照 2.0 原型 paper/shell.js；样式在 spec/styles/paper/components.css
// ============================================================

import { Link } from "@/lib/router";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { Avatar, FRONTEND_STACK, ROLE_LABEL, SkinSwitch, TechIcon, useHealth, useThemeToggle } from "@/components/shared";
import { UserMenu, navProps, useNavKey, useScrolled } from "@/components/shellParts";
import type { StackItem } from "@/types";
import { CreateLink } from "@/components/LoginPrompt";

/** 品牌标：一枚印，印文是信封的折口——也像指向十点十分的表针 */
export function PaperLogo({ className }: { className?: string }) {
  return (
    <svg className={className ? `logo ${className}` : "logo"} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="var(--color-accent)" />
      <path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--color-on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="17" r="2.6" fill="var(--color-on-accent)" />
    </svg>
  );
}

function Brand({ label }: { label?: string }) {
  return (
    <Link className="brand" to="/" aria-label={label}>
      <PaperLogo />
      <span className="brand__name latin">HelloTime</span>
      <sup className="brand__pro mono">PRO</sup>
    </Link>
  );
}

export function PaperHeader() {
  const user = useAuth((s) => s.user);
  const cur = useNavKey();
  const scrolled = useScrolled();
  const { theme, onClick } = useThemeToggle();
  return (
    <header className={`hdr${scrolled ? " is-scrolled" : ""}`}>
      <div className="wrap hdr__in">
        <Brand label="HelloTime Pro 首页" />
        <nav className="nav" aria-label="主导航">
          <Link to="/" data-testid="nav-plaza" {...navProps("plaza", cur)}>
            广场
          </Link>
          <Link to="/open" data-testid="nav-open" {...navProps("open", cur)}>
            开启
          </Link>
          <Link to="/about" data-testid="nav-about" {...navProps("about", cur)}>
            关于
          </Link>
        </nav>
        <div className="hdr__act">
          <CreateLink data-testid="nav-create" {...navProps("create", cur, "btn btn--ghost btn--sm hdr__write")}>
            <Icon name="pen" />
            写一枚
          </CreateLink>
          <SkinSwitch />
          <button
            className="iconbtn theme"
            type="button"
            data-testid="theme-toggle"
            aria-label={theme === "dark" ? "切换到日间主题" : "切换到夜间主题"}
            onClick={onClick}
          >
            <Icon name="sun" className="theme__sun" />
            <Icon name="moon" className="theme__moon" />
          </button>
          {user ? (
            <UserMenu createdIcon="mail" />
          ) : (
            <>
              <Link className="btn btn--text hdr__login" to="/login" data-testid="nav-login">
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

function StackLi({ it }: { it: StackItem }) {
  return (
    <li title={ROLE_LABEL[it.role] ?? it.role} data-testid="stack-item" data-name={it.name}>
      <TechIcon item={it} className="tech__ic" />
      <span>{it.name}</span>
      <small className="mono">{it.version}</small>
    </li>
  );
}

export function PaperFooter() {
  const { health, online } = useHealth();
  const backend = health?.stack.items ?? [];
  const backendName = backend.find((i) => i.role === "framework")?.name ?? backend[0]?.name;
  return (
    <footer className="ftr">
      <div className="wrap ftr__in">
        <div className="ftr__brand">
          <Brand />
          <p className="ftr__motto serif">把此刻，寄给未来。</p>
          <p className="ftr__fine">一个多技术栈对比学习项目 · 不面向生产</p>
        </div>
        <div className="ftr__colo">
          <div className="ftr__k">
            <span>本页由以下技术栈排印</span>
            <span className="ftr__live">
              <span className={`dot${online ? " dot--on" : ""}`} />
              {online === false ? "后端离线" : online ? `后端在线 · ${backendName ?? ""}` : "连接中…"}
            </span>
          </div>
          <ul className="stack" data-testid="footer-stack">
            {FRONTEND_STACK.map((it) => (
              <StackLi key={`f-${it.name}`} it={it} />
            ))}
            {backend.length ? (
              <li className="stack__x" aria-hidden="true">
                ×
              </li>
            ) : null}
            {backend.map((it) => (
              <StackLi key={`b-${it.role}-${it.name}`} it={it} />
            ))}
          </ul>
        </div>
      </div>
      <div className="wrap ftr__base">
        <span>© 2026 HelloTime Pro · MIT License</span>
        <nav aria-label="页脚">
          <Link to="/">广场</Link>
          <Link to="/open">开启</Link>
          <Link to="/about">关于</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PaperTabBar() {
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
        <span>写信</span>
      </CreateLink>
      <Link to={user ? "/me/created" : "/login"} data-testid="tab-me" {...navProps("me", cur)}>
        {user ? <Avatar id={user.avatarId} /> : <Icon name="user" />}
        <span>{user ? "我的" : "登录"}</span>
      </Link>
    </nav>
  );
}
