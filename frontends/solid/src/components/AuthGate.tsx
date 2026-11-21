import { Show, type JSX } from "solid-js";
import { Navigate, useLocation } from "@solidjs/router";
import { auth } from "@/stores/auth";
import { loginPath } from "@/lib/redirect";

// 路由守卫：未登录跳到 /login?redirect=<当前路径含查询串>，登录后回跳。
// 有 user 直接通过；只有 refreshToken（刷新页未拿到 access）也允许进入，接口调用会自动 refresh。
// 登录态在 main.tsx 里首次渲染之前就恢复了，所以第一帧就能判断对。
export function AuthGate(props: { children: JSX.Element }) {
  const location = useLocation();
  return (
    <Show when={auth.hydrated}>
      <Show when={auth.user || auth.refreshToken} fallback={<Navigate href={loginPath(location.pathname + location.search)} />}>
        {props.children}
      </Show>
    </Show>
  );
}
