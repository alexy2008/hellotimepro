import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { useAuth } from "@/stores/auth";
import { PaperCreatePage } from "@/skins/paper/CreatePage";
import { AmberCreatePage } from "@/skins/amber/CreatePage";

/** 创建页：逻辑共用（hooks/useCreateCapsule，含草稿与 AI），视图按皮肤各一份 */
export function CreatePage() {
  const skin = useUi((s) => s.skin);
  const user = useAuth((s) => s.user);
  useEffect(() => {
    document.title = "写给未来 · HelloTime Pro";
  }, []);
  // 刷新页时只有 refresh token、用户信息还在路上：等它到了再渲染（页面要用头像与昵称）
  if (!user) return null;
  return skin === "paper" ? <PaperCreatePage /> : <AmberCreatePage />;
}
