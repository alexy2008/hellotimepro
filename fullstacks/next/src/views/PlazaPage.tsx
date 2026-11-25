"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CodeOpenContext, useRouteCodeOpen } from "@/hooks/useCodeOpen";
import { PlazaSeedContext } from "@/hooks/usePlazaHome";
import { FavoriteProjectionContext } from "@/components/FavButton";
import { useUi } from "@/stores/ui";
import { getSessionVersion, useAuth } from "@/stores/auth";
import { canUseSeed, usePlaza } from "@/stores/plaza";
import { PaperHomePage } from "@/skins/paper/HomePage";
import { AmberHomePage } from "@/skins/amber/HomePage";
import type { PlazaSeed } from "@/types";

/**
 * 首页 = 胶囊广场：逻辑共用（hooks/usePlazaHome），视图按皮肤各一份。
 *
 * initial 是服务端以匿名身份取好的第一屏。查询条件匹配时接纳新的首屏，
 * 登录用户再补收藏状态。保留的筛选与服务器首屏不同时，按当前筛选刷新。
 */
export function PlazaPage({ initial }: { initial: PlazaSeed | null }) {
  const opener = useRouteCodeOpen();
  const skin = useUi((s) => s.skin);
  const session = useAuth((s) => s.hydrated ? getSessionVersion() : null);
  const userId = useAuth((s) => s.user?.id ?? null);

  const favoriteSession = usePlaza((s) => s.favoriteSession);
  const favoriteFailed = usePlaza((s) => s.favoriteFailed);

  const [seed, setSeed] = useState(() => {
    if (!initial) return null;
    const state = session === null ? usePlaza.getInitialState() : usePlaza.getState();
    return canUseSeed(state, initial) ? initial : null;
  });
  const fromServer = useRef(seed !== null);

  // 首屏写进 store：layout effect 在浏览器绘制前完成，换成读 store 时内容不变
  useLayoutEffect(() => {
    if (!seed) return;
    usePlaza.getState().seed(seed);
    setSeed(null);
  }, [seed]);

  // 进入首页、登录态变化（favoritedByMe 会变）时刷新；登录态恢复之前不取（还不知道是谁在看）
  useEffect(() => {
    if (session === null) return;
    if (fromServer.current) {
      fromServer.current = false;
      if (userId) void usePlaza.getState().refreshViewer();
      return;
    }
    void usePlaza.getState().refreshAll();
  }, [session, userId]);

  return (
    <PlazaSeedContext.Provider value={seed}>
      <FavoriteProjectionContext.Provider value={{
        ready: !seed && session !== null && favoriteSession === session,
        failed: favoriteFailed,
        retry: () => { void usePlaza.getState().refreshViewer(); },
      }}>
        <CodeOpenContext.Provider value={opener}>{skin === "paper" ? <PaperHomePage /> : <AmberHomePage />}</CodeOpenContext.Provider>
      </FavoriteProjectionContext.Provider>
    </PlazaSeedContext.Provider>
  );
}
