import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { PaperAboutPage } from "@/skins/paper/AboutPages";
import { AmberAboutPage } from "@/skins/amber/AboutPages";

/** 关于：文字两套皮肤共用（lib/about.ts），排版各一份 */
export function AboutPage() {
  const skin = useUi((s) => s.skin);
  useEffect(() => {
    document.title = "关于 · HelloTime Pro";
  }, []);
  return skin === "paper" ? <PaperAboutPage /> : <AmberAboutPage />;
}
