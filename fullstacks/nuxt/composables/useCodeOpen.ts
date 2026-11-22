// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
// ============================================================

import { inject, onScopeDispose, provide, ref, type InjectionKey } from "vue";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { sleep } from "@/lib/fmt";

export type CodeState = "" | "checking" | "ok" | "error";

export const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
export const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";

function createCodeOpen() {
  const router = useRouter();
  const state = ref<CodeState>("");
  const error = ref("");
  /** 每次出错加一，输码框据此重播「抖一下」 */
  const shake = ref(0);
  const value = ref("");
  let generation = 0;
  let pending: string | null = null;
  onScopeDispose(() => generation++);

  const fail = (msg: string) => {
    state.value = "error";
    error.value = msg;
    shake.value++;
  };

  async function go(code: string) {
    if (pending === code) return;
    const request = ++generation;
    if (code.length !== 8) return fail(MSG_FORMAT);
    pending = code;
    error.value = "";
    state.value = "checking";
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([api.capsuleByCode(code), sleep(480)]);
      if (request !== generation) return;
      state.value = "ok";
      await sleep(260);
      if (request === generation) await router.push(`/capsules/${c.code}`);
    } catch (e) {
      if (request === generation) fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
    } finally {
      if (request === generation) pending = null;
    }
  }

  function input(v: string) {
    generation++;
    pending = null;
    value.value = v;
    state.value = "";
    error.value = "";
  }

  return { value, state, error, shake, go, input };
}

const codeOpenKey: InjectionKey<ReturnType<typeof createCodeOpen>> = Symbol("codeOpen");

export function provideCodeOpen() {
  provide(codeOpenKey, createCodeOpen());
}

export function useCodeOpen() {
  const opener = inject(codeOpenKey);
  if (!opener) throw new Error("输码框需要使用所属路由的状态");
  return opener;
}
