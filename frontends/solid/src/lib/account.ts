// ============================================================
// 账号表单的纯规则：邮箱、昵称、密码的格式，以及把后端字段错误映射到表单。
// 不依赖 Solid，两套皮肤和单元测试都直接用。
// ============================================================

import { ApiError } from "@/types";

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
/** 昵称：字母、数字、下划线、连字符，2–20 位——u 标志下按 Unicode 码点计数（𠮷 算一个字） */
export const NICK_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
export const pwdRules = (v: string) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
export const pwdValid = (v: string) => {
  const r = pwdRules(v);
  return r.len && r.alpha && r.digit;
};

export type Errors = Record<string, string | undefined>;
export type NickStateValue = "" | "valid" | "invalid" | "taken";

/**
 * 昵称的即时检查：没有专门的唯一性接口，这里只做格式；
 * 服务端明确返回昵称冲突（409）时才显示 taken
 */
export function nickState(v: string, errors?: Errors): { state: NickStateValue; hint?: string } {
  if (errors?.nickname) return { state: errors.nicknameState === "taken" ? "taken" : "invalid", hint: errors.nickname };
  const t = v.trim();
  if (!t) return { state: "" };
  if (Array.from(t).length < 2) return { state: "", hint: "至少 2 个字符" };
  if (!NICK_RE.test(t)) return { state: "invalid", hint: "只能用字母、数字、下划线和连字符" };
  return { state: "valid" };
}

/** 后端的字段错误（422 details / 409 field）映射到表单字段；提交期间昵称又改过时丢掉昵称那条 */
export function fieldErrors(e: unknown, nicknameChanged = false): Errors {
  if (!(e instanceof ApiError)) return { form: "网络异常，请稍后再试" };
  const out: Errors = {};
  for (const d of e.details ?? []) out[d.field] = d.message;
  if (out["nickname"] && e.status === 409) out["nicknameState"] = "taken";
  if (!Object.keys(out).length) out.form = e.message;
  if (nicknameChanged) {
    delete out.nickname;
    delete out.nicknameState;
  }
  return out;
}
