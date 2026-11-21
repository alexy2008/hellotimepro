"use client";
// 根布局（Server Component）与客户端应用之间的桥：next/dynamic + ssr:false，
// 让整棵应用树只在浏览器里渲染（原因见 components/App.tsx 顶部注释）。

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { AvatarDef } from "@/lib/avatars";

const App = dynamic(() => import("@/components/App"), { ssr: false });

export function ClientRoot({ avatars, children }: { avatars: AvatarDef[]; children: ReactNode }) {
  return <App avatars={avatars}>{children}</App>;
}
