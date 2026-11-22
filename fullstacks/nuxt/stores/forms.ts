// ============================================================
// 账号表单的内容：登录 / 注册 / 资料 / 改密码。
// 切换皮肤会把视图组件整个换掉，值若放在组件自己的 ref 里就丢了（spec/ui/testids.md X5），
// 所以放在这里。提交成功、登出、离开该页面时清空，密码不会在内存里久留
// （「离开」由 composables/useAccount.ts 里的路由守卫判断）。
// ============================================================

import { defineStore } from "pinia";
import { reactive, watch } from "vue";
import { useAuthStore } from "@/stores/auth";

const blank = {
  login: () => ({ email: "", password: "" }),
  register: () => ({ email: "", nickname: "", password: "", avatarId: "neo" }),
  /** userId：这份资料表单是替谁填的；换了账号就重新从当前用户填 */
  profile: () => ({ userId: null as string | null, nickname: "", avatarId: "" }),
  pwd: () => ({ current: "", next: "", confirm: "" }),
};

export type FormKey = keyof typeof blank;

export const useFormsStore = defineStore("forms", () => {
  const login = reactive(blank.login());
  const register = reactive(blank.register());
  const profile = reactive(blank.profile());
  const pwd = reactive(blank.pwd());
  const forms = { login, register, profile, pwd };

  function clear(...keys: FormKey[]) {
    for (const k of keys) Object.assign(forms[k], blank[k]());
  }

  // 登出 / 换账号：全部清空
  const auth = useAuthStore();
  watch(
    () => auth.user?.id,
    (id, prev) => {
      if (prev && id !== prev) clear("login", "register", "profile", "pwd");
    },
  );

  return { login, register, profile, pwd, clear };
});
