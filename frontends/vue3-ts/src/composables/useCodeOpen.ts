// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
// ============================================================

import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { sleep } from "@/lib/fmt";

export type CodeState = "" | "checking" | "ok" | "error";

export const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
export const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";

export function useCodeOpen() {
  const router = useRouter();
  const state = ref<CodeState>("");
  const error = ref("");
  /** 每次出错加一，输码框据此重播「抖一下」 */
  const shake = ref(0);
  let busy = false;

  const fail = (msg: string) => {
    state.value = "error";
    error.value = msg;
    shake.value++;
  };

  async function go(code: string) {
    if (busy) return;
    if (code.length !== 8) return fail(MSG_FORMAT);
    busy = true;
    error.value = "";
    state.value = "checking";
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([api.capsuleByCode(code), sleep(480)]);
      state.value = "ok";
      await sleep(260);
      await router.push(`/capsules/${c.code}`);
    } catch (e) {
      fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
    } finally {
      busy = false;
    }
  }

  /** 用户又开始输入：清掉错误态 */
  function reset() {
    if (state.value === "error") state.value = "";
    error.value = "";
  }

  return { state, error, shake, go, reset };
}
