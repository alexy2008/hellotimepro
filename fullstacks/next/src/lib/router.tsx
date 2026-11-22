"use client";
// ============================================================
// 导航适配层：把 React 参考前端用到的那几个 react-router API
// （Link / useNavigate / useLocation / useParams / Navigate）落到 Next App Router 上。
//
// 页面与皮肤组件因此能与 frontends/react-ts 逐行对照；路由表本身不在这里，
// 而是 app/ 下的文件系统路由（app/capsules/[code]/page.tsx 等）。
// ============================================================

import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, type AnchorHTMLAttributes, type ReactNode, type Ref } from "react";

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLAnchorElement>;
};

/** `<Link to>` → next/link 的 `<Link href>`；onClick 里 preventDefault 会阻止跳转（与 react-router 一致） */
export function Link({ to, replace, ...rest }: LinkProps) {
  return <NextLink href={to} replace={replace} {...rest} />;
}

export interface NavigateOptions {
  replace?: boolean;
}

/** `navigate(to, { replace })` → router.push / router.replace；数字表示历史前进后退 */
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, opts?: NavigateOptions) => {
      if (typeof to === "number") window.history.go(to);
      else if (opts?.replace) router.replace(to);
      else router.push(to);
    },
    [router],
  );
}

/** `{ pathname, search }`：search 带前导 `?`，没有查询参数时为空串 */
export function useLocation() {
  const pathname = usePathname() ?? "/";
  const qs = useSearchParams()?.toString() ?? "";
  return { pathname, search: qs ? `?${qs}` : "" };
}

/** 动态段参数（app/capsules/[code] → { code }） */
export function useParams<T extends Record<string, string | undefined>>(): T {
  return (useNextParams() ?? {}) as T;
}

/**
 * 渲染即跳转（守卫用）。服务端渲染时什么也不输出；跳转放在 effect 里，
 * 只会在水合完成之后执行——这时 App Router 已经接管 history，
 * replace 能真正切换页面，不会出现「只改了地址栏」的情况（docs/05 第 2 节第 7 条）。
 */
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}
