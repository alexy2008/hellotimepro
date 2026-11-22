"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CodeOpenContext, useRouteCodeOpen } from "@/hooks/useCodeOpen";
import { PlazaSeedContext } from "@/hooks/usePlazaHome";
import { useUi } from "@/stores/ui";
import { useAuth } from "@/stores/auth";
import { canUseSeed, usePlaza } from "@/stores/plaza";
import { PaperHomePage } from "@/skins/paper/HomePage";
import { AmberHomePage } from "@/skins/amber/HomePage";
import type { PlazaSeed } from "@/types";

/**
 * 首页 = 胶囊广场：逻辑共用（hooks/usePlazaHome），视图按皮肤各一份。
 *
 * initial 是服务端（app/page.tsx）以匿名身份取好的第一屏。广场 store 还没有自己的数据、
 * 查询条件也是默认值时（服务端渲染、水合、客户端第一次进入首页）直接用它，不再重复请求；
 * 登录用户水合后静默重取一次列表与精选，补上 favoritedByMe。
 * 之前加载过（筛选、搜索、翻页都还在 store 里）就照旧整页刷新。
 */
export function PlazaPage({ initial }: { initial: PlazaSeed | null }) {
  const opener = useRouteCodeOpen();
  const skin = useUi((s) => s.skin);
  const authReady = useAuth((s) => s.hydrated);
  const userId = useAuth((s) => s.user?.id ?? null);

  const [seed, setSeed] = useState(() => (initial && canUseSeed(usePlaza.getState(), initial) ? initial : null));
  const fromServer = useRef(seed !== null);

  // 首屏写进 store：layout effect 在浏览器绘制前完成，换成读 store 时内容不变
  useLayoutEffect(() => {
    if (!seed) return;
    usePlaza.getState().seed(seed);
    setSeed(null);
  }, [seed]);

  // 进入首页、登录态变化（favoritedByMe 会变）时刷新；登录态恢复之前不取（还不知道是谁在看）
  useEffect(() => {
    if (!authReady) return;
    if (fromServer.current) {
      fromServer.current = false;
      if (userId) void usePlaza.getState().refreshViewer();
      return;
    }
    void usePlaza.getState().refreshAll();
  }, [authReady, userId]);

  return (
    <PlazaSeedContext.Provider value={seed}>
      <CodeOpenContext.Provider value={opener}>{skin === "paper" ? <PaperHomePage /> : <AmberHomePage />}</CodeOpenContext.Provider>
    </PlazaSeedContext.Provider>
  );
}
