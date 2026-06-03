import { Show, type JSX } from "solid-js";
import { Navigate, useLocation } from "@solidjs/router";
import { auth } from "@/stores/auth";

// 路由守卫：未登录跳到 /login，并把当前 URL 放到 state 里以便登录后回跳。
// 有 user 直接通过；只有 refreshToken（刷新页未拿到 access）也允许进入，
// 接口调用会自动 refresh。
export function AuthGate(props: { children: JSX.Element }) {
  const location = useLocation();
  return (
    <Show when={auth.hydrated} fallback={null}>
      <Show
        when={auth.user || auth.refreshToken}
        fallback={<Navigate href="/login" state={{ from: location.pathname }} />}
      >
        {props.children}
      </Show>
    </Show>
  );
}
