import { Show } from "solid-js";
import { auth } from "@/stores/auth";
import { createCapsuleForm } from "@/primitives/capsuleForm";
import { PaperCreatePage } from "@/skins/paper/CreatePage";
import { AmberCreatePage } from "@/skins/amber/CreatePage";
import { Skinned } from "./Skinned";

/**
 * 创建页：按账号建一份表单状态（提交锁、AI 任务、成功回执都归它）。
 * 刷新页时只有 refresh token、用户信息还在路上：等它到了再渲染（页面要用头像与昵称）；
 * 换了账号就整份重建
 */
export function CreatePage() {
  document.title = "写给未来 · HelloTime Pro";
  return (
    <Show when={auth.user?.id} keyed>
      {(id) => <CreateForm owner={id} />}
    </Show>
  );
}

/** owner：这份表单属于哪个账号（keyed 的 <Show> 按它重建） */
function CreateForm(_props: { owner: string }) {
  const f = createCapsuleForm();
  return <Skinned paper={<PaperCreatePage f={f} />} amber={<AmberCreatePage f={f} />} />;
}
