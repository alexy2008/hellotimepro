import { useEffect } from "react";
import { CodeOpenContext, useRouteCodeOpen } from "@/hooks/useCodeOpen";
import { useUi } from "@/stores/ui";
import { PaperHomePage } from "@/skins/paper/HomePage";
import { AmberHomePage } from "@/skins/amber/HomePage";

/** 首页 = 胶囊广场：逻辑共用（hooks/usePlazaHome），视图按皮肤各一份 */
export function PlazaPage() {
  const opener = useRouteCodeOpen();
  const skin = useUi((s) => s.skin);
  useEffect(() => {
    document.title = "把此刻寄给未来 · HelloTime Pro";
  }, []);
  return <CodeOpenContext.Provider value={opener}>{skin === "paper" ? <PaperHomePage /> : <AmberHomePage />}</CodeOpenContext.Provider>;
}
