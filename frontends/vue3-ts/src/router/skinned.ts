// ============================================================
// 路由组件「按皮肤挑视图」：同一条路由，时笺与琥珀各一份视图，逻辑都在 composables 里。
// 切换皮肤时视图整个换掉，路由不动；草稿、表单、广场筛选在 store 里，所以都还在（X5）。
// needsUser：需要当前用户资料才能画的页面（创建、我的）——登出那一瞬 user 先变空，
// 守卫的跳转还在路上，这时先什么都不画。
// ============================================================

import { defineComponent, h, type Component } from "vue";
import { useUiStore, type Skin } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

export function skinned(name: string, views: Record<Skin, Component>, opts: { needsUser?: boolean; setup?: () => void } = {}) {
  return defineComponent({
    name,
    setup() {
      opts.setup?.();
      const ui = useUiStore();
      const auth = useAuthStore();
      return () => (opts.needsUser && !auth.user ? null : h(views[ui.skin]));
    },
  });
}
