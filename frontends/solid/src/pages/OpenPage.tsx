import { CodeOpenContext, createCodeOpen } from "@/primitives/codeOpen";
import { createMySealed } from "@/primitives/capsule";
import { PaperOpenPage } from "@/skins/paper/CapsulePages";
import { AmberOpenPage } from "@/skins/amber/CapsulePages";
import { Skinned } from "./Skinned";

/** 开启页：输码状态按路由保存（切皮肤不丢已填的码），登录后附「我封存过的胶囊」 */
export function OpenPage() {
  document.title = "开启胶囊 · HelloTime Pro";
  const opener = createCodeOpen();
  const mine = createMySealed();
  return (
    <CodeOpenContext.Provider value={opener}>
      <Skinned paper={<PaperOpenPage mine={mine} />} amber={<AmberOpenPage mine={mine} />} />
    </CodeOpenContext.Provider>
  );
}
