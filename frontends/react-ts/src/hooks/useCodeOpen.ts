// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
// ============================================================

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { sleep } from "@/lib/fmt";

export type CodeState = "" | "checking" | "ok" | "error";

export const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
export const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";

export function useCodeOpen() {
  const navigate = useNavigate();
  const [state, setState] = useState<CodeState>("");
  const [error, setError] = useState("");
  /** 每次出错加一，输码框据此重播「抖一下」 */
  const [shake, setShake] = useState(0);
  const busy = useRef(false);

  const fail = (msg: string) => {
    setState("error");
    setError(msg);
    setShake((n) => n + 1);
  };

  async function go(code: string) {
    if (busy.current) return;
    if (code.length !== 8) return fail(MSG_FORMAT);
    busy.current = true;
    setError("");
    setState("checking");
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([api.capsuleByCode(code), sleep(480)]);
      setState("ok");
      await sleep(260);
      navigate(`/capsules/${c.code}`);
    } catch (e) {
      fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
    } finally {
      busy.current = false;
    }
  }

  /** 用户又开始输入：清掉错误态 */
  const reset = () => {
    if (state === "error") setState("");
    setError("");
  };

  return { state, error, shake, go, reset };
}
