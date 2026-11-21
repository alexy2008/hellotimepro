// ============================================================
// 外壳里两套皮肤共用的导航小工具：当前导航项、body[data-route]、页面标题、守卫跳转
// ============================================================

import { tick } from "svelte";
import { navigate } from "svelte-routing";

/**
 * 守卫类的跳转（未登录去登录页、/me 补成 /me/created…）：替换当前历史记录，并等这一轮挂载结束再跳。
 * svelte-routing 的 Router 在自己的 onMount 里才开始监听 history，而子组件的 effect / onMount 先于父组件运行——
 * 首屏直接打开受保护页面时若立刻 navigate，只会改地址栏，页面不跟着变。
 */
export function redirect(to: string) {
  void tick().then(() => navigate(to, { replace: true }));
}

export type NavKey = "plaza" | "open" | "create" | "about" | "me" | null;

/** 当前路径属于哪个导航项：详情页归在「开启」下，登录注册归在「我的」下 */
export function navKey(p: string): NavKey {
  if (p === "/") return "plaza";
  if (p === "/open" || p.startsWith("/capsules/")) return "open";
  if (p === "/create") return "create";
  if (p === "/about") return "about";
  if (p.startsWith("/me") || p === "/login" || p === "/register") return "me";
  return null;
}

/** 导航链接的公共属性：高亮类名 + aria-current（整个对象展开到 <a> 上） */
export function navAttrs(key: NavKey, cur: NavKey, base = "") {
  const on = key === cur;
  return {
    class: [base, on ? "is-active" : ""].filter(Boolean).join(" ") || undefined,
    "aria-current": on ? ("page" as const) : undefined,
  };
}

/** 路由名：写到 body[data-route]，个别皮肤样式按页面微调 */
export function routeName(path: string): string {
  if (path === "/") return "plaza";
  if (path.startsWith("/capsules/")) return "capsule";
  if (path.startsWith("/me")) return "me";
  return path.slice(1).split("/")[0] || "plaza";
}

const TITLE: Record<string, string> = {
  plaza: "把此刻寄给未来",
  open: "开启胶囊",
  about: "关于",
  login: "登录",
  register: "注册",
  create: "写给未来",
  me: "我的",
};

/** 页面标题；详情页的标题等胶囊取回来后由 CapsuleState 写 */
export function routeTitle(path: string): string | null {
  const name = routeName(path);
  if (name === "capsule") return null;
  return (TITLE[name] ?? "查无此页") + " · HelloTime Pro";
}
