import { CodeOpenContext, createCodeOpen } from "@/primitives/codeOpen";
import { createPlazaHome } from "@/primitives/plazaHome";
import { PaperHomePage } from "@/skins/paper/HomePage";
import { AmberHomePage } from "@/skins/amber/HomePage";
import { Skinned } from "./Skinned";

/** 首页 = 胶囊广场：路由页建好首页逻辑与输码状态，交给两套皮肤的视图 */
export function PlazaPage() {
  document.title = "把此刻寄给未来 · HelloTime Pro";
  const opener = createCodeOpen();
  const h = createPlazaHome();
  return (
    <CodeOpenContext.Provider value={opener}>
      <Skinned paper={<PaperHomePage h={h} />} amber={<AmberHomePage h={h} />} />
    </CodeOpenContext.Provider>
  );
}
