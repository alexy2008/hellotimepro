// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
//
// 路由页（PlazaPage / OpenPage）各创建一份，经 context 交给皮肤里的输码框：
// 切皮肤只换视图，已填的码、进行中的查询都还在；改码或离页后，旧查询及延迟跳转一律作废。
// ============================================================

import { createContext, createSignal, onCleanup, useContext } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { sleep } from "@/lib/fmt";

export type CodeState = "" | "checking" | "ok" | "error";

export const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
export const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";

export function createCodeOpen() {
  const navigate = useNavigate();
  const [state, setState] = createSignal<CodeState>("");
  const [error, setError] = createSignal("");
  /** 每次出错加一，输码框据此重播「抖一下」 */
  const [shake, setShake] = createSignal(0);
  const [value, setValue] = createSignal("");
  let generation = 0;
  let pending: string | null = null;
  onCleanup(() => generation++);

  const fail = (msg: string) => {
    setState("error");
    setError(msg);
    setShake((n) => n + 1);
  };

  async function go(code: string) {
    if (pending === code) return;
    const request = ++generation;
    if (code.length !== 8) return fail(MSG_FORMAT);
    pending = code;
    setError("");
    setState("checking");
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([api.capsuleByCode(code), sleep(480)]);
      if (request !== generation) return;
      setState("ok");
      await sleep(260);
      if (request === generation) navigate(`/capsules/${c.code}`);
    } catch (e) {
      if (request === generation) fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
    } finally {
      if (request === generation) pending = null;
    }
  }

  function input(v: string) {
    generation++;
    pending = null;
    setValue(v);
    setState("");
    setError("");
  }

  return { value, state, error, shake, go, input };
}

export type CodeOpener = ReturnType<typeof createCodeOpen>;

export const CodeOpenContext = createContext<CodeOpener>();

/** 皮肤里的输码框取所属路由的输码状态 */
export function useCodeOpen(): CodeOpener {
  const opener = useContext(CodeOpenContext);
  if (!opener) throw new Error("输码框需要使用所属路由的状态");
  return opener;
}
