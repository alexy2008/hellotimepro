import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useUi } from "@/stores/ui";
import { useAuth } from "@/stores/auth";
import { PaperMePage } from "@/skins/paper/AccountPages";
import { AmberMePage } from "@/skins/amber/AccountPages";

const TABS = ["created", "favorites", "profile"] as const;
type Tab = (typeof TABS)[number];

/** 「我的」：三个页签共用一个页面组件，切页签时页头与统计不重绘 */
export function MePage() {
  const skin = useUi((s) => s.skin);
  const user = useAuth((s) => s.user);
  const { tab } = useParams();
  useEffect(() => {
    document.title = "我的 · HelloTime Pro";
  }, []);
  if (!TABS.includes(tab as Tab)) return <Navigate to="/me/created" replace />;
  // 只有 refresh token、user 还在路上（刷新页）时先等一下
  if (!user) return null;
  return skin === "paper" ? <PaperMePage tab={tab as Tab} /> : <AmberMePage tab={tab as Tab} />;
}
