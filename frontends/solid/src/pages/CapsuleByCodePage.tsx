import { Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { createCapsuleByCode } from "@/primitives/capsule";
import { PaperCapsulePage } from "@/skins/paper/CapsulePages";
import { AmberCapsulePage } from "@/skins/amber/CapsulePages";
import { Skinned } from "./Skinned";

/**
 * 胶囊详情 /capsules/:code。从一枚胶囊跳到另一枚时路由组件不会重建，
 * 所以按 code 用 keyed 的 <Show> 包一层：换码就整份状态重建，旧的请求、轮询随之作废
 */
export function CapsuleByCodePage() {
  const params = useParams();
  return (
    <Show when={params.code} keyed>
      {(code) => <CapsuleView code={code} />}
    </Show>
  );
}

function CapsuleView(props: { code: string }) {
  const d = createCapsuleByCode(props.code);
  return <Skinned paper={<PaperCapsulePage d={d} />} amber={<AmberCapsulePage d={d} />} />;
}
