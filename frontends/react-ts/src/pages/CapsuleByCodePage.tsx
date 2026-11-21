import { useParams } from "react-router-dom";
import { useUi } from "@/stores/ui";
import { PaperCapsulePage } from "@/skins/paper/CapsulePages";
import { AmberCapsulePage } from "@/skins/amber/CapsulePages";

/** 胶囊详情 /capsules/:code：逻辑共用（hooks/useCapsule），视图按皮肤各一份 */
export function CapsuleByCodePage() {
  const { code } = useParams();
  const skin = useUi((s) => s.skin);
  return skin === "paper" ? <PaperCapsulePage key={code} /> : <AmberCapsulePage key={code} />;
}
