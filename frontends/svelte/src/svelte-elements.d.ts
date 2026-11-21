// svelte-routing 的 links 会接管站内 <a> 的点击；带 noroute 属性的链接（如「跳到正文」）不接管
export {};

declare module "svelte/elements" {
  interface HTMLAnchorAttributes {
    noroute?: boolean;
  }
}
