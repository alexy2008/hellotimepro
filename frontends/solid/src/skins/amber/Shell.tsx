// ============================================================
// 「琥珀」外壳：悬浮胶囊顶栏 · 页脚 · 手机底栏
// 结构与类名照 2.0 原型 amber/shell.js；样式在 spec/styles/amber/components.css
// ============================================================

import { For, Show, createUniqueId } from "solid-js";
import { Icon } from "@/lib/icons";
import { auth } from "@/stores/auth";
import { theme } from "@/stores/ui";
import { FRONTEND_STACK, ROLE_LABEL } from "@/lib/about";
import { Avatar, SkinSwitch, TechIcon, createHealth, onThemeClick } from "@/components/shared";
import { UserMenu, createNav, createScrolled } from "@/components/shellParts";
import { CreateLink } from "@/components/LoginPrompt";
import { createSlider } from "@/components/Seg";
import type { StackItem } from "@/types";

/** 标志：一枚被时间轨道环绕的倾斜胶囊（插画固定配色，不随主题变） */
export function AmberLogo(props: { size?: number; class?: string }) {
  const u = createUniqueId();
  const size = () => props.size ?? 34;
  return (
    <svg class={props.class ? `logo ${props.class}` : "logo"} width={size()} height={size()} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${u}n`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#34267e" />
          <stop offset="1" stop-color="#0a0e28" />
        </linearGradient>
        <linearGradient id={`${u}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffe59a" />
          <stop offset=".5" stop-color="#ffb347" />
          <stop offset="1" stop-color="#ff7a45" />
        </linearGradient>
        <linearGradient id={`${u}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" />
          <stop offset="1" stop-color="#c9d1ff" />
        </linearGradient>
        <radialGradient id={`${u}w`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#ffb347" stop-opacity=".55" />
          <stop offset="1" stop-color="#ffb347" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${u}n)`} />
      <circle cx="32" cy="32" r="24" fill={`url(#${u}w)`} />
      <g transform="rotate(45 32 32)">
        <path d="M5 32A27 8 0 0 1 59 32" fill="none" stroke="#b9afff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 3.4" />
        <path d="M22 32V22a10 10 0 0 1 20 0v10Z" fill={`url(#${u}a)`} />
        <path d="M22 32v10a10 10 0 0 0 20 0V32Z" fill={`url(#${u}g)`} />
        <rect x="26.5" y="35.5" width="11" height="10.5" rx="2" fill="#ffd98a" fill-opacity=".9" />
        <path d="M28.8 39h6.4M28.8 42h4.6" stroke="#b06a1c" stroke-width="1.1" stroke-linecap="round" />
        <rect x="20.6" y="30.4" width="22.8" height="3.2" rx="1.6" fill="#1b1550" />
        <path d="M26.2 23a5.8 5.8 0 0 1 4.2-5.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round" />
        <path d="M5 32A27 8 0 0 0 59 32" fill="none" stroke="#d9d3ff" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="51" cy="37.2" r="2.6" fill="#ffd27a" />
      </g>
      <path d="M13 43q.5 3.5 4 4-3.5.5-4 4-.5-3.5-4-4 3.5-.5 4-4Z" fill="#ffe59a" />
      <circle cx="50.5" cy="13.5" r="1.4" fill="#fff" fill-opacity=".9" />
      <circle cx="44" cy="8.5" r=".8" fill="#fff" fill-opacity=".6" />
    </svg>
  );
}

const NAV = [
  ["plaza", "/", "胶囊广场"],
  ["create", "/create", "写一枚"],
  ["open", "/open", "开启胶囊"],
  ["about", "/about", "关于"],
] as const;

export function AmberHeader() {
  const nav = createNav();
  const scrolled = createScrolled();
  let navEl: HTMLElement | undefined;
  // 导航高亮底：跟着当前页滑过去（首次定位不带过渡；当前页不在导航里时隐藏）
  const ink = createSlider(() => navEl, ".nav__link.is-active", () => [nav.cur(), auth.user], true);

  return (
    <header class={`hdr${scrolled() ? " is-scrolled" : ""}`}>
      <div class="hdr__bar">
        <a class="brand" href="/" aria-label="HelloTime Pro 首页">
          <AmberLogo size={34} class="brand__logo" />
          <span class="brand__name">
            HelloTime<small>PRO</small>
          </span>
        </a>
        <nav class="nav" ref={navEl} aria-label="主导航">
          <span class="nav__ink" aria-hidden="true" style={ink()} />
          <For each={NAV}>
            {([k, to, label]) =>
              k === "create" ? (
                <CreateLink data-testid="nav-create" class={nav.cls(k, "nav__link")} aria-current={nav.current(k)}>
                  {label}
                </CreateLink>
              ) : (
                <a href={to} data-testid={`nav-${k}`} class={nav.cls(k, "nav__link")} aria-current={nav.current(k)}>
                  {label}
                </a>
              )
            }
          </For>
        </nav>
        <div class="hdr__tools">
          <SkinSwitch />
          <button
            class="theme-toggle"
            type="button"
            role="switch"
            data-testid="theme-toggle"
            aria-checked={theme() === "light"}
            aria-label={theme() === "light" ? "当前为晨曦（亮色），切换到星夜" : "当前为星夜（暗色），切换到晨曦"}
            onClick={onThemeClick}
          >
            <span class="theme-toggle__stars" />
            <span class="theme-toggle__cloud" />
            <span class="theme-toggle__knob" />
          </button>
          <Show
            when={auth.user}
            fallback={
              <>
                <a class="btn btn--ghost btn--sm hdr__login" href="/login" data-testid="nav-login">
                  登录
                </a>
                <a class="btn btn--primary btn--sm" href="/register" data-testid="nav-register">
                  注册
                </a>
              </>
            }
          >
            <UserMenu createdIcon="feather" />
          </Show>
        </div>
      </div>
    </header>
  );
}

function Chip(props: { it: StackItem }) {
  return (
    <span
      class="ftr__tech"
      title={`${ROLE_LABEL[props.it.role] ?? props.it.role} · ${props.it.name} ${props.it.version ?? ""}`}
      data-testid="stack-item"
      data-name={props.it.name}
    >
      <TechIcon item={props.it} class="tech-ic" />
      {props.it.name}
    </span>
  );
}

export function AmberFooter() {
  const h = createHealth();
  return (
    <footer class="ftr">
      <div class="ftr__in">
        <a class="ftr__brand" href="/">
          <AmberLogo size={22} />
          HelloTime Pro · 时间胶囊
        </a>
        <div class="ftr__stack" data-testid="footer-stack">
          <span class="ftr__dot" title={h.online() === false ? "后端离线" : "后端在线"} data-online={h.online() ?? undefined} />
          <For each={FRONTEND_STACK}>{(it) => <Chip it={it} />}</For>
          <Show when={h.backend().length}>
            <i class="ftr__x">×</i>
          </Show>
          <For each={h.backend()}>{(it) => <Chip it={it} />}</For>
        </div>
        <div class="ftr__meta">
          <span>把此刻，寄给未来</span>
          <span class="mono">v2.0</span>
        </div>
      </div>
    </footer>
  );
}

export function AmberTabBar() {
  const nav = createNav();
  return (
    <nav class="tabbar" aria-label="主导航">
      <a href="/" data-testid="tab-plaza" class={nav.cls("plaza")} aria-current={nav.current("plaza")}>
        <Icon name="grid" />
        <span>广场</span>
      </a>
      <a href="/open" data-testid="tab-open" class={nav.cls("open")} aria-current={nav.current("open")}>
        <Icon name="key" />
        <span>开启</span>
      </a>
      <CreateLink data-testid="tab-create" class={nav.cls("create", "tabbar__main")} aria-current={nav.current("create")}>
        <i>
          <Icon name="pen" />
        </i>
        <span>写一枚</span>
      </CreateLink>
      <a href={auth.user ? "/me/created" : "/login"} data-testid="tab-me" class={nav.cls("me")} aria-current={nav.current("me")}>
        <Show when={auth.user} fallback={<Icon name="user" />}>
          {(u) => <Avatar id={u().avatarId} />}
        </Show>
        <span>{auth.user ? "我的" : "登录"}</span>
      </a>
    </nav>
  );
}
