// ============================================================
// 外壳里两套皮肤共用的逻辑：当前导航项、页头滚动状态、用户菜单。
// ============================================================

import { Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { auth, logout } from "@/stores/auth";
import { toast } from "@/stores/feedback";
import { Icon, type IconName } from "@/lib/icons";
import { Avatar } from "@/components/shared";

export type NavKey = "plaza" | "open" | "create" | "about" | "me" | null;

/** 当前路由属于哪个导航项：详情页归在「开启」下，登录注册归在「我的」下 */
export function useNavKey() {
  const location = useLocation();
  return createMemo<NavKey>(() => {
    const p = location.pathname;
    if (p === "/") return "plaza";
    if (p === "/open" || p.startsWith("/capsules/")) return "open";
    if (p === "/create") return "create";
    if (p === "/about") return "about";
    if (p.startsWith("/me") || p === "/login" || p === "/register") return "me";
    return null;
  });
}

/**
 * 导航链接的高亮：cls(key, base) 给类名（当前项加 is-active），current(key) 给 aria-current。
 * 写成两个显式属性，读起来比展开一个对象更直白，也不必操心展开属性的响应性。
 */
export function createNav() {
  const cur = useNavKey();
  return {
    cur,
    cls: (key: NavKey, base = "") => [base, cur() === key ? "is-active" : ""].filter(Boolean).join(" ") || undefined,
    current: (key: NavKey) => (cur() === key ? ("page" as const) : undefined),
  };
}

/** 页头滚动后加 is-scrolled（细线 / 描边由皮肤样式决定） */
export function createScrolled() {
  const [scrolled, setScrolled] = createSignal(window.scrollY > 6);
  const onScroll = () => setScrolled(window.scrollY > 6);
  window.addEventListener("scroll", onScroll, { passive: true });
  onCleanup(() => window.removeEventListener("scroll", onScroll));
  return scrolled;
}

/** 已登录时页头右侧的头像菜单。createdIcon：两套皮肤给「我创建的」配的图标不同 */
export function UserMenu(props: { createdIcon: IconName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  let box: HTMLDivElement | undefined;

  createEffect(on(() => location.pathname, () => setOpen(false), { defer: true }));
  createEffect(() => {
    if (!open()) return;
    const onDoc = (e: MouseEvent) => {
      if (!box?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <Show when={auth.user}>
      {(user) => (
        <div class={`umenu${open() ? " is-open" : ""}`} ref={box}>
          <button
            class="uchip"
            type="button"
            aria-haspopup="menu"
            aria-expanded={open()}
            aria-label={`${user().nickname} 的菜单`}
            data-testid="user-menu"
            data-nickname={user().nickname}
            onClick={() => setOpen((v) => !v)}
          >
            <Avatar id={user().avatarId} />
            <span class="uchip__n">{user().nickname}</span>
            <Icon name="chev-down" class="ic--chev" />
          </button>
          <div class="umenu__pop" role="menu">
            <div class="umenu__who">
              <Avatar id={user().avatarId} class="av--lg" />
              <div>
                <b>{user().nickname}</b>
                <span class="mono">{user().email}</span>
              </div>
            </div>
            <a role="menuitem" href="/me/created" data-testid="menu-created">
              <Icon name={props.createdIcon} />
              我创建的
            </a>
            <a role="menuitem" href="/me/favorites" data-testid="menu-favorites">
              <Icon name="heart" />
              我收藏的
            </a>
            <a role="menuitem" href="/me/profile" data-testid="menu-profile">
              <Icon name="sliders" />
              账号设置
            </a>
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
      )}
    </Show>
  );
}
