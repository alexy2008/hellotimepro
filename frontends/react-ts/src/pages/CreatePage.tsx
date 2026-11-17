import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { PaperCreatePage } from "@/skins/paper/CreatePage";
import { AmberCreatePage } from "@/skins/amber/CreatePage";

/** 创建页：逻辑共用（hooks/useCreateCapsule，含草稿与 AI），视图按皮肤各一份 */
export function CreatePage() {
  const skin = useUi((s) => s.skin);
  useEffect(() => {
    document.title = "写给未来 · HelloTime Pro";
  }, []);
  return skin === "paper" ? <PaperCreatePage /> : <AmberCreatePage />;
}
