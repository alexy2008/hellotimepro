import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { A } from "@solidjs/router";
import { auth, logout } from "@/stores/auth";
import { ThemeToggle } from "./ThemeToggle";
import { avatarUrl } from "@/utils/avatar";

function shortName(name: string): string {
  return Array.from(name).slice(0, 4).join("");
}

export function AppHeader() {
  const [menuOpen, setMenuOpen] = createSignal(false);
  let menuRef: HTMLDivElement | undefined;

  // 菜单展开时：点击外部或按 Esc 收起
  createEffect(() => {
    if (!menuOpen()) return;

    function closeOnOutsidePointer(e: PointerEvent) {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    onCleanup(() => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    });
  });

  return (
    <header class="cy-header">
      <div class="cy-container cy-header__inner">
        <A href="/" class="cy-brand">
          <img class="cy-brand__mark" src="/logo.svg" width={38} height={38} alt="" />
          HelloTime<span class="cy-brand__pro">PRO</span>
        </A>
        <nav class="cy-nav">
          <A href="/" end activeClass="cy-nav__active">
            广场
          </A>
          <A href="/open" activeClass="cy-nav__active">
            开启
          </A>
          <A href="/about" activeClass="cy-nav__active">
            关于
          </A>
        </nav>
        <div class="cy-header__actions">
          <ThemeToggle />
          <Show
            when={auth.user}
            fallback={
              <>
                <A href="/login" class="cy-btn cy-btn--ghost cy-btn--sm">
                  登录
                </A>
                <A href="/register" class="cy-btn cy-btn--primary cy-btn--sm">
                  注册
                </A>
              </>
            }
          >
            {(user) => (
              <div class="cy-user-menu" ref={menuRef}>
                <button
                  type="button"
                  class="cy-user-chip cy-user-chip--button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen()}
                  aria-label={`${user().nickname} 的菜单`}
                  title={user().nickname}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span title={user().nickname}>{shortName(user().nickname)}</span>
                  <img src={avatarUrl(user().avatarId)} alt="" />
                  <span class="cy-user-chip__chevron" aria-hidden="true">
                    ⌄
                  </span>
                </button>
                <Show when={menuOpen()}>
                  <div class="cy-user-dropdown" role="menu">
                    <A
                      href="/me/created"
                      role="menuitem"
                      class="cy-user-dropdown__item"
                      activeClass="is-active"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span aria-hidden="true">📝</span>
                      <span>我创建的</span>
                    </A>
                    <A
                      href="/me/favorites"
                      role="menuitem"
                      class="cy-user-dropdown__item"
                      activeClass="is-active"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span aria-hidden="true">♥</span>
                      <span>我收藏的</span>
                    </A>
                    <A
                      href="/me/profile"
                      role="menuitem"
                      class="cy-user-dropdown__item"
                      activeClass="is-active"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span aria-hidden="true">⚙</span>
                      <span>账号设置</span>
                    </A>
                    <span class="cy-user-dropdown__divider" />
                    <button
                      type="button"
                      class="cy-user-dropdown__item cy-user-dropdown__item--danger"
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
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
    </header>
  );
}
