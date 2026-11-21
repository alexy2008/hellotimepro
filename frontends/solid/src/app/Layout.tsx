// ============================================================
// 总布局（Router 的 root）：按当前皮肤挑外壳，中间是路由页面。
// 外壳的 DOM 约定照 2.0 原型：header.hdr / main#view / footer.ftr / nav.tabbar，
// 皮肤样式里有 #view、body[data-route] 等选择器依赖这些约定。
// ============================================================

import { createEffect, on, type JSX } from "solid-js";
import { useLocation } from "@solidjs/router";
import { DialogHost, Toasts } from "@/components/Feedback";
import { Skinned } from "@/pages/Skinned";
import { PaperFooter, PaperHeader, PaperTabBar } from "@/skins/paper/Shell";
import { AmberFooter, AmberHeader, AmberTabBar } from "@/skins/amber/Shell";
import { AmberBackdrop } from "@/skins/amber/Sky";

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

export function Layout(props: { children?: JSX.Element }) {
  const location = useLocation();

  createEffect(
    on(
      () => location.pathname,
      (p) => {
        document.body.dataset.route = routeName(p);
        window.scrollTo(0, 0);
      },
    ),
  );

  return (
    <>
      <PaperFilters />
      <AmberBackdrop />
      <a class="skip" href="#view">
        跳到正文
      </a>
      <Skinned paper={<PaperHeader />} amber={<AmberHeader />} />
      <main id="view" tabIndex={-1}>
        {props.children}
      </main>
      <Skinned paper={<PaperFooter />} amber={<AmberFooter />} />
      <Skinned paper={<PaperTabBar />} amber={<AmberTabBar />} />
      <Toasts />
      <DialogHost />
    </>
  );
}
