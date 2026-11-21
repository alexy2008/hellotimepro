// ============================================================
// 匿名用户点了需要登录的操作（收藏、创建入口）：先弹确认框，确认后带 ?redirect= 去登录
// （spec/ui/testids.md X7，文案见 spec/ui/copy.md §4）
// ============================================================

import { confirmDialog } from "@/stores/feedback.svelte.ts";
import LoginMark from "@/components/LoginMark.svelte";

/** 问一句要不要去登录；返回用户是否确认 */
export function askLogin(kind: "favorite" | "create"): Promise<boolean> {
  return kind === "favorite"
    ? confirmDialog({
        title: "登录后才能收藏",
        body: "收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。",
        confirm: "去登录",
        cancel: "再逛逛",
        mark: { component: LoginMark, props: { ch: "藏", icon: "heart" } },
      })
    : confirmDialog({
        title: "登录后才能写胶囊",
        body: "胶囊会存在你的账号下：之后在「我的」里随时能找到它、复制胶囊码，或者删除它。",
        confirm: "去登录",
        cancel: "再逛逛",
        mark: { component: LoginMark, props: { ch: "缄", icon: "pen" } },
      });
}
