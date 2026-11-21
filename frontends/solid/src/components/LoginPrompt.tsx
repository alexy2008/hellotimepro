// ============================================================
// 匿名用户点了需要登录的操作（收藏、创建入口）：先弹确认框，确认后带 ?redirect= 去登录
// （spec/ui/testids.md X7，文案见 spec/ui/copy.md）
// ============================================================

import { splitProps, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { auth } from "@/stores/auth";
import { skin } from "@/stores/ui";
import { confirmDialog } from "@/stores/feedback";
import { loginPath } from "@/lib/redirect";
import { Icon, type IconName } from "@/lib/icons";
import { Seal } from "@/skins/paper/parts";

/** 登录提示框顶部的小标记：时笺盖一枚朱文印，琥珀是一个图标 */
export function LoginMark(props: { ch: string; icon: IconName }) {
  return <div class="dlg__mark">{skin() === "paper" ? <Seal ch={props.ch} variant="line" /> : <Icon name={props.icon} />}</div>;
}

/** 问一句要不要去登录；返回用户是否确认 */
export function askLogin(kind: "favorite" | "create"): Promise<boolean> {
  return kind === "favorite"
    ? confirmDialog({
        title: "登录后才能收藏",
        body: () => <p>收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。</p>,
        confirm: "去登录",
        cancel: "再逛逛",
        mark: () => <LoginMark ch="藏" icon="heart" />,
      })
    : confirmDialog({
        title: "登录后才能写胶囊",
        body: () => <p>胶囊会存在你的账号下：之后在「我的」里随时能找到它、复制胶囊码，或者删除它。</p>,
        confirm: "去登录",
        cancel: "再逛逛",
        mark: () => <LoginMark ch="缄" icon="pen" />,
      });
}

/**
 * 指向 /create 的链接：已登录直接去；匿名时先确认，再去 /login?redirect=/create。
 * Solid 的委托事件先于路由器对 <a> 的拦截运行（路由器为此专门先调了 delegateEvents），
 * 所以在 onClick 里 preventDefault 就能挡住这次跳转。
 */
export function CreateLink(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & { "data-testid"?: string }) {
  const [local, rest] = splitProps(props, ["onClick", "children"]);
  const navigate = useNavigate();
  const click: JSX.EventHandler<HTMLAnchorElement, MouseEvent> = async (e) => {
    if (typeof local.onClick === "function") local.onClick(e);
    if (auth.user || e.defaultPrevented) return;
    e.preventDefault();
    if (await askLogin("create")) navigate(loginPath("/create"));
  };
  return (
    <a {...rest} href="/create" onClick={click}>
      {local.children}
    </a>
  );
}
