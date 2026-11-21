// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
//
// 状态归路由页面所有（pages/PlazaPage、pages/OpenPage 创建一份，经 context 交给皮肤视图），
// 所以切换皮肤时已输入的码、错误提示都还在；离开路由时作废进行中的查询。
// ============================================================

import { createContext } from "svelte";
import { navigate } from "svelte-routing";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { sleep } from "@/lib/fmt";

export type CodeState = "" | "checking" | "ok" | "error";

// 既保留中间空格位，又让琥珀的原生输入框可以定位到这一格。
export const EMPTY_CODE_CELL = "\u00a0";
export const isCompleteCode = (value: string) => /^[A-Z0-9]{8}$/.test(value);

export const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
export const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";

export class CodeOpen {
  value = $state("");
  state = $state<CodeState>("");
  error = $state("");
  /** 每次出错加一，输码框据此重播「抖一下」 */
  shake = $state(0);
  #generation = 0;
  #pending: string | null = null;

  /** 须在组件初始化时创建：组件销毁（离开路由）时作废进行中的查询 */
  constructor() {
    $effect(() => () => void this.#generation++);
  }

  #fail(msg: string) {
    this.state = "error";
    this.error = msg;
    this.shake++;
  }

  go = async (code: string) => {
    if (this.#pending === code) return;
    if (!isCompleteCode(code)) return this.#fail(MSG_FORMAT);
    const request = ++this.#generation;
    this.#pending = code;
    this.error = "";
    this.state = "checking";
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([api.capsuleByCode(code), sleep(480)]);
      if (request !== this.#generation) return;
      this.state = "ok";
      await sleep(260);
      if (request === this.#generation) navigate(`/capsules/${c.code}`);
    } catch (e) {
      if (request === this.#generation) this.#fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
    } finally {
      if (request === this.#generation) this.#pending = null;
    }
  };

  /** 输码框里的字变了：作废进行中的查询，收起提示 */
  input = (v: string) => {
    if (v === this.value) return;
    this.#generation++;
    this.#pending = null;
    this.value = v;
    this.state = "";
    this.error = "";
  };
}

const [get, set] = createContext<CodeOpen>();
/** 路由页面调用：创建并提供本路由的输码状态 */
export const provideCodeOpen = () => set(new CodeOpen());
/** 皮肤视图里的输码框调用 */
export const useCodeOpen = get;
