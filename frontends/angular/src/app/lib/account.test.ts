import { describe, expect, it } from 'vitest';
import { emailOk, nickState, pwdRules, pwdValid } from './account';

describe('账号表单的校验规则', () => {
  it('邮箱：有 @ 和域名后缀才算', () => {
    expect(emailOk('a@b.co')).toBe(true);
    expect(emailOk(' a@b.co ')).toBe(true);
    expect(emailOk('a@b')).toBe(false);
    expect(emailOk('ab.co')).toBe(false);
  });

  it('昵称：太短不提示错误，非法字符算 invalid，合规算 valid', () => {
    expect(nickState('')).toEqual({ state: '' });
    expect(nickState('a')).toEqual({ state: '', hint: '至少 2 个字符' });
    expect(nickState('有 空格').state).toBe('invalid');
    expect(nickState('时光_01').state).toBe('valid');
  });

  it('密码：至少 8 位，且同时含字母和数字', () => {
    expect(pwdRules('abc')).toEqual({ len: false, alpha: true, digit: false });
    expect(pwdValid('abcdefgh')).toBe(false);
    expect(pwdValid('abcd1234')).toBe(true);
  });
});
