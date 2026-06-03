import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { logout } from "@/stores/auth";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

export function MeLayout(props: { children?: JSX.Element }) {
  return (
    <>
      <AppHeader />
      <main class="cy-container">
        <div class="cy-me">
          <aside class="cy-me__nav">
            <A href="/me/created" activeClass="is-active">
              📝 我创建的
            </A>
            <A href="/me/favorites" activeClass="is-active">
              ♥ 我收藏的
            </A>
            <A href="/me/profile" activeClass="is-active">
              ⚙ 账号设置
            </A>
            <span
              style={{
                "border-top": "1px solid var(--color-border-subtle)",
                margin: "var(--space-3) 0",
              }}
            />
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                void logout().then(() => window.location.assign("/"));
              }}
              style={{ color: "var(--color-danger-fg)" }}
            >
              登出
            </a>
          </aside>
          <section class="cy-me__content">{props.children}</section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
