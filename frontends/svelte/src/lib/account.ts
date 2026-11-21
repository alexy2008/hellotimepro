// ============================================================
// 账号表单的校验规则与小类型（两套皮肤、几个 Facade 共用；纯函数，可单测）
// ============================================================

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const NICK_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
export const NICK_MSG = '昵称需为 2–20 个字符：字母、数字、下划线或连字符';
export const pwdRules = (v: string) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
export const pwdValid = (v: string) => {
  const r = pwdRules(v);
  return r.len && r.alpha && r.digit;
};

/** 昵称的即时检查：没有专门的唯一性接口，这里只做格式；重名在提交时由后端告诉我们 */
export function nickState(v: string, errors?: Errors): { state: '' | 'valid' | 'invalid' | 'taken'; hint?: string } {
  if (errors?.['nickname']) return { state: errors['nicknameState'] === "taken" ? "taken" : "invalid", hint: errors['nickname'] };
  const t = v.trim();
  if (!t) return { state: '' };
  if (Array.from(t).length < 2) return { state: '', hint: '至少 2 个字符' };
  if (!NICK_RE.test(t)) return { state: 'invalid', hint: '只能用字母、数字、下划线和连字符' };
  return { state: 'valid' };
}

export type FormMsg = { type: 'ok' | 'err' | 'info'; text: string } | null;
export type Errors = Record<string, string | undefined>;
