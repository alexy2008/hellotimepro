import { PaperAboutPage } from "@/skins/paper/AboutPages";
import { AmberAboutPage } from "@/skins/amber/AboutPages";
import { Skinned } from "./Skinned";

/** 关于：文字两套皮肤共用（lib/about.ts），排版各一份 */
export function AboutPage() {
  document.title = "关于 · HelloTime Pro";
  return <Skinned paper={<PaperAboutPage />} amber={<AmberAboutPage />} />;
}
