// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
// ============================================================

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { sleep } from "@/lib/fmt";

export type CodeState = "" | "checking" | "ok" | "error";

export const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
export const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";

export function useRouteCodeOpen() {
  const navigate = useNavigate();
  const [state, setState] = useState<CodeState>("");
  const [error, setError] = useState("");
  /** 每次出错加一，输码框据此重播「抖一下」 */
  const [shake, setShake] = useState(0);
  const [value, setValue] = useState("");
  const generation = useRef(0);
  const pending = useRef<string | null>(null);
  useLayoutEffect(() => () => { generation.current++; }, []);

  const fail = (msg: string) => {
    setState("error");
    setError(msg);
    setShake((n) => n + 1);
  };

  async function go(code: string) {
    if (pending.current === code) return;
    const request = ++generation.current;
    if (code.length !== 8) return fail(MSG_FORMAT);
    pending.current = code;
    setError("");
    setState("checking");
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([api.capsuleByCode(code), sleep(480)]);
      if (request !== generation.current) return;
      setState("ok");
      await sleep(260);
      if (request === generation.current) navigate(`/capsules/${c.code}`);
    } catch (e) {
      if (request === generation.current) fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
    } finally {
      if (request === generation.current) pending.current = null;
    }
  }

  function input(v: string) {
    generation.current++;
    pending.current = null;
    setValue(v);
    setState("");
    setError("");
  }

  return { value, state, error, shake, go, input };
}

export const CodeOpenContext = createContext<ReturnType<typeof useRouteCodeOpen> | null>(null);

export function useCodeOpen() {
  const opener = useContext(CodeOpenContext);
  if (!opener) throw new Error("输码框需要使用所属路由的状态");
  return opener;
}
