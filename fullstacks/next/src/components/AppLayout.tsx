// ============================================================
// 总布局：按当前皮肤挑外壳，中间是路由页面（App Router 传进来的 children）。
// 外壳的 DOM 约定照 2.0 原型：header.hdr / main#view / footer.ftr / nav.tabbar，
// 皮肤样式里有 #view、body[data-route] 等选择器依赖这些约定。
// ============================================================

import { useEffect, type ComponentType, type ReactNode } from "react";
import { useLocation } from "@/lib/router";
import { useUi, type Skin } from "@/stores/ui";
import { DialogHost, Toasts } from "@/components/Feedback";
import { PaperFooter, PaperHeader, PaperTabBar } from "@/skins/paper/Shell";
import { AmberFooter, AmberHeader, AmberTabBar } from "@/skins/amber/Shell";
import { AmberBackdrop } from "@/skins/amber/Sky";

const SHELL: Record<Skin, { Header: ComponentType; Footer: ComponentType; TabBar: ComponentType }> = {
  paper: { Header: PaperHeader, Footer: PaperFooter, TabBar: PaperTabBar },
  amber: { Header: AmberHeader, Footer: AmberFooter, TabBar: AmberTabBar },
};

/** 路由名：写到 body[data-route]，个别皮肤样式按页面微调 */
function routeName(pathname: string): string {
  if (pathname === "/") return "plaza";
  if (pathname.startsWith("/capsules/")) return "capsule";
  if (pathname.startsWith("/me")) return "me";
  return pathname.slice(1).split("/")[0] || "plaza";
}

/** 「时笺」的油墨毛边滤镜：印章与邮戳用 filter: url(#f-rough / #f-ink) 引用 */
function PaperFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="f-rough" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={1.5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="f-ink" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={3} seed={11} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.2} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.4 0 0 0 2.55" result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const skin = useUi((s) => s.skin);
  const { pathname } = useLocation();
  const { Header, Footer, TabBar } = SHELL[skin];

  useEffect(() => {
    document.body.dataset.route = routeName(pathname);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <PaperFilters />
      <AmberBackdrop />
      <a className="skip" href="#view">
        跳到正文
      </a>
      <Header />
      <main id="view" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <TabBar />
      <Toasts />
      <DialogHost />
    </>
  );
}
