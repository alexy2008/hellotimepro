import { describe, expect, it } from 'vitest';
import { emailOk, nickState, pwdRules, pwdValid } from './account';

describe('账号表单的校验规则', () => {
  it('邮箱：有 @ 和域名后缀才算', () => {
    expect(emailOk('a@b.co')).toBe(true);
    expect(emailOk(' a@b.co ')).toBe(true);
    expect(emailOk('a@b')).toBe(false);
    expect(emailOk('ab.co')).toBe(false);
  });

  it('昵称：按 Unicode 码点校验；太短不提示错误，非法字符算 invalid', () => {
    expect(nickState('')).toEqual({ state: '' });
    expect(nickState('a')).toEqual({ state: '', hint: '至少 2 个字符' });
    expect(nickState('有 空格').state).toBe('invalid');
    expect(nickState('时光_01').state).toBe('valid');
    expect(nickState('Ünïcode-名').state).toBe('valid');
    expect(nickState('a'.repeat(21)).state).toBe('invalid');
  });

  it('昵称：只有服务端明确说冲突（409）才是 taken，其余字段错误是 invalid', () => {
    expect(nickState('时光', { nickname: '昵称已被占用', nicknameState: 'taken' })).toEqual({ state: 'taken', hint: '昵称已被占用' });
    expect(nickState('时光', { nickname: '格式不对' }).state).toBe('invalid');
  });

  it('密码：至少 8 位，且同时含字母和数字', () => {
    expect(pwdRules('abc')).toEqual({ len: false, alpha: true, digit: false });
    expect(pwdValid('abcdefgh')).toBe(false);
    expect(pwdValid('abcd1234')).toBe(true);
  });
});
