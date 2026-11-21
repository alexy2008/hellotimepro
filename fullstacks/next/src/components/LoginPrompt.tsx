// ============================================================
// 匿名用户点了需要登录的操作（收藏、创建入口）：先弹确认框，确认后带 ?redirect= 去登录
// （spec/ui/testids.md X7，文案见 spec/ui/copy.md）
// ============================================================

import type { MouseEvent } from "react";
import { Link, useNavigate, type LinkProps } from "@/lib/router";
import { useAuth } from "@/stores/auth";
import { useUi } from "@/stores/ui";
import { confirmDialog } from "@/stores/feedback";
import { loginPath } from "@/lib/redirect";
import { Icon, type IconName } from "@/lib/icons";
import { Seal } from "@/skins/paper/parts";

/** 登录提示框顶部的小标记：时笺盖一枚朱文印，琥珀是一个图标 */
export function LoginMark({ ch, icon }: { ch: string; icon: IconName }) {
  const skin = useUi((s) => s.skin);
  return <div className="dlg__mark">{skin === "paper" ? <Seal ch={ch} variant="line" /> : <Icon name={icon} />}</div>;
}

/** 问一句要不要去登录；返回用户是否确认 */
export function askLogin(kind: "favorite" | "create"): Promise<boolean> {
  return kind === "favorite"
    ? confirmDialog({
        title: "登录后才能收藏",
        body: <p>收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。</p>,
        confirm: "去登录",
        cancel: "再逛逛",
        mark: <LoginMark ch="藏" icon="heart" />,
      })
    : confirmDialog({
        title: "登录后才能写胶囊",
        body: <p>胶囊会存在你的账号下：之后在「我的」里随时能找到它、复制胶囊码，或者删除它。</p>,
        confirm: "去登录",
        cancel: "再逛逛",
        mark: <LoginMark ch="缄" icon="pen" />,
      });
}

/** 指向 /create 的链接：已登录直接去；匿名时先确认，再去 /login?redirect=/create */
export function CreateLink({ onClick, ...props }: Omit<LinkProps, "to"> & { "data-testid"?: string }) {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  async function click(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (user || e.defaultPrevented) return;
    e.preventDefault();
    if (await askLogin("create")) navigate(loginPath("/create"));
  }
  return <Link {...props} to="/create" onClick={(e) => void click(e)} />;
}
