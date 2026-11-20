// ============================================================
// 外壳里两套皮肤共用的逻辑：当前导航项、页头滚动态、明暗切换、后端 /health
// ============================================================

import { computed, onBeforeUnmount, onMounted, onScopeDispose, ref, shallowRef } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/api/client";
import { useUiStore } from "@/stores/ui";
import type { HealthData } from "@/types";

export type NavKey = "plaza" | "open" | "create" | "about" | "me" | null;

/** 当前路由属于哪个导航项：详情页归在「开启」下，登录注册归在「我的」下 */
export function useNavKey() {
  const route = useRoute();
  return computed<NavKey>(() => {
    const p = route.path;
    if (p === "/") return "plaza";
    if (p === "/open" || p.startsWith("/capsules/")) return "open";
    if (p === "/create") return "create";
    if (p === "/about") return "about";
    if (p.startsWith("/me") || p === "/login" || p === "/register") return "me";
    return null;
  });
}

/** 导航链接的公共属性：高亮类名 + aria-current（v-bind 整个对象） */
export function navAttrs(key: NavKey, cur: NavKey, base = "") {
  const on = key === cur;
  return {
    class: [base, on ? "is-active" : ""].filter(Boolean).join(" ") || undefined,
    "aria-current": on ? ("page" as const) : undefined,
  };
}

/** 页头滚动后加 is-scrolled（细线 / 描边由皮肤样式决定） */
export function useScrolled() {
  const scrolled = ref(false);
  const on = () => (scrolled.value = window.scrollY > 6);
  onMounted(() => {
    on();
    window.addEventListener("scroll", on, { passive: true });
  });
  onBeforeUnmount(() => window.removeEventListener("scroll", on));
  return scrolled;
}

/** 明暗切换的点击处理：从点击位置晕开；键盘触发时从按钮中心晕开 */
export function useThemeToggle() {
  const ui = useUiStore();
  const toggle = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const kb = e.clientX === 0 && e.clientY === 0;
    ui.toggleTheme({ x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY });
  };
  return { theme: computed(() => ui.theme), toggle };
}

/** 当前后端的 /health：页脚与关于页共用，只请求一次 */
let healthPromise: Promise<HealthData> | null = null;
export function useHealth() {
  const health = shallowRef<HealthData | null>(null);
  const online = ref<boolean | null>(null);
  let alive = true;
  healthPromise ??= api.health();
  healthPromise
    .then((h) => {
      if (!alive) return;
      health.value = h;
      online.value = true;
    })
    .catch(() => {
      healthPromise = null;
      if (alive) online.value = false;
    });
  onScopeDispose(() => (alive = false));

  const backend = computed(() => health.value?.stack.items ?? []);
  /** 后端的名字：优先取「框架」那一项 */
  const backendName = computed(() => backend.value.find((i) => i.role === "framework")?.name ?? backend.value[0]?.name);
  return { health, online, backend, backendName };
}
