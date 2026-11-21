"use client";

import { useEffect } from "react";
import { CodeOpenContext, useRouteCodeOpen } from "@/hooks/useCodeOpen";
import { useUi } from "@/stores/ui";
import { PaperOpenPage } from "@/skins/paper/CapsulePages";
import { AmberOpenPage } from "@/skins/amber/CapsulePages";

/** 开启页：逻辑共用（hooks/useCodeOpen、useMySealed），视图按皮肤各一份 */
export function OpenPage() {
  const opener = useRouteCodeOpen();
  const skin = useUi((s) => s.skin);
  useEffect(() => {
    document.title = "开启胶囊 · HelloTime Pro";
  }, []);
  return <CodeOpenContext.Provider value={opener}>{skin === "paper" ? <PaperOpenPage /> : <AmberOpenPage />}</CodeOpenContext.Provider>;
}
