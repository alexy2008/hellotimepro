// ============================================================
// 「时笺」外壳：页头 · 页脚（技术栈题记）· 手机底栏
// 结构与类名照 2.0 原型 paper/shell.js；样式在 spec/styles/paper/components.css
// ============================================================

import { For, Show } from "solid-js";
import { Icon } from "@/lib/icons";
import { auth } from "@/stores/auth";
import { theme } from "@/stores/ui";
import { FRONTEND_STACK, ROLE_LABEL } from "@/lib/about";
import { Avatar, SkinSwitch, TechIcon, createHealth, onThemeClick } from "@/components/shared";
import { UserMenu, createNav, createScrolled } from "@/components/shellParts";
import { CreateLink } from "@/components/LoginPrompt";
import type { StackItem } from "@/types";

/** 品牌标：一枚印，印文是信封的折口——也像指向十点十分的表针 */
export function PaperLogo(props: { class?: string }) {
  return (
    <svg class={props.class ? `logo ${props.class}` : "logo"} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="var(--color-accent)" />
      <path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--color-on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="14" cy="17" r="2.6" fill="var(--color-on-accent)" />
    </svg>
  );
}

function Brand(props: { label?: string }) {
  return (
    <a class="brand" href="/" aria-label={props.label}>
      <PaperLogo />
      <span class="brand__name latin">HelloTime</span>
      <sup class="brand__pro mono">PRO</sup>
    </a>
  );
}

export function PaperHeader() {
  const nav = createNav();
  const scrolled = createScrolled();
  return (
    <header class={`hdr${scrolled() ? " is-scrolled" : ""}`}>
      <div class="wrap hdr__in">
        <Brand label="HelloTime Pro 首页" />
        <nav class="nav" aria-label="主导航">
          <a href="/" data-testid="nav-plaza" class={nav.cls("plaza")} aria-current={nav.current("plaza")}>
            广场
          </a>
          <a href="/open" data-testid="nav-open" class={nav.cls("open")} aria-current={nav.current("open")}>
            开启
          </a>
          <a href="/about" data-testid="nav-about" class={nav.cls("about")} aria-current={nav.current("about")}>
            关于
          </a>
        </nav>
        <div class="hdr__act">
          <CreateLink data-testid="nav-create" class={nav.cls("create", "btn btn--ghost btn--sm hdr__write")} aria-current={nav.current("create")}>
            <Icon name="pen" />
            写一枚
          </CreateLink>
          <SkinSwitch />
          <button
            class="iconbtn theme"
            type="button"
            data-testid="theme-toggle"
            aria-label={theme() === "dark" ? "切换到日间主题" : "切换到夜间主题"}
            onClick={onThemeClick}
          >
            <Icon name="sun" class="theme__sun" />
            <Icon name="moon" class="theme__moon" />
          </button>
          <Show
            when={auth.user}
            fallback={
              <>
                <a class="btn btn--text hdr__login" href="/login" data-testid="nav-login">
                  登录
                </a>
                <a class="btn btn--primary btn--sm" href="/register" data-testid="nav-register">
                  注册
                </a>
              </>
            }
          >
            <UserMenu createdIcon="mail" />
          </Show>
        </div>
      </div>
    </header>
  );
}

function StackLi(props: { it: StackItem }) {
  return (
    <li title={ROLE_LABEL[props.it.role] ?? props.it.role} data-testid="stack-item" data-name={props.it.name}>
      <TechIcon item={props.it} class="tech__ic" />
      <span>{props.it.name}</span>
      <small class="mono">{props.it.version}</small>
    </li>
  );
}

export function PaperFooter() {
  const h = createHealth();
  return (
    <footer class="ftr">
      <div class="wrap ftr__in">
        <div class="ftr__brand">
          <Brand />
          <p class="ftr__motto serif">把此刻，寄给未来。</p>
          <p class="ftr__fine">一个多技术栈对比学习项目 · 不面向生产</p>
        </div>
        <div class="ftr__colo">
          <div class="ftr__k">
            <span>本页由以下技术栈排印</span>
            <span class="ftr__live">
              <span class={`dot${h.online() ? " dot--on" : ""}`} />
              {h.online() === false ? "后端离线" : h.online() ? `后端在线 · ${h.backendName() ?? ""}` : "连接中…"}
            </span>
          </div>
          <ul class="stack" data-testid="footer-stack">
            <For each={FRONTEND_STACK}>{(it) => <StackLi it={it} />}</For>
            <Show when={h.backend().length}>
              <li class="stack__x" aria-hidden="true">
                ×
              </li>
            </Show>
            <For each={h.backend()}>{(it) => <StackLi it={it} />}</For>
          </ul>
        </div>
      </div>
      <div class="wrap ftr__base">
        <span>© 2026 HelloTime Pro · MIT License</span>
        <nav aria-label="页脚">
          <a href="/">广场</a>
          <a href="/open">开启</a>
          <a href="/about">关于</a>
        </nav>
      </div>
    </footer>
  );
}

export function PaperTabBar() {
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
        <span>写信</span>
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
