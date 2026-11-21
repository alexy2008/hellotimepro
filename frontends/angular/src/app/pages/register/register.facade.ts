// 注册页的页面逻辑，由 RegisterPage 提供、两套皮肤注入同一份（表单值跨皮肤保留、离开页面即销毁）
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { FeedbackStore } from '@/stores/feedback.store';
import { safeRedirect } from '@/lib/redirect';
import { emailOk, type Errors, NICK_MSG, NICK_RE, nickState, pwdValid } from '@/lib/account';
import { injectAvatarIds } from '@/shared/avatar-ids';
import { ApiError } from '@/types';
import { injectRedirectParam } from '../login/login.facade';

/** 后端的字段错误（422 details / 409 field）映射到表单字段 */
export function fieldErrors(e: unknown, nicknameChanged = false): Errors {
  if (!(e instanceof ApiError)) return { form: '网络异常，请稍后再试' };
  const out: Errors = {};
  for (const d of e.details ?? []) out[d.field] = d.message;
  if (out["nickname"] && e.status === 409) out["nicknameState"] = "taken";
  if (!Object.keys(out).length) out['form'] = e.message;
  if (nicknameChanged) {
    delete out['nickname'];
    delete out['nicknameState'];
  }
  return out;
}

@Injectable()
export class RegisterFacade {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly nickname = signal('');
  readonly password = signal('');
  readonly avatarId = signal('neo');
  readonly errors = signal<Errors>({});
  readonly busy = signal(false);
  readonly redirect = injectRedirectParam();
  readonly avatarIds = injectAvatarIds();
  readonly nick = computed(() => nickState(this.nickname(), this.errors()));

  setNickname(v: string) {
    this.nickname.set(v);
    this.errors.update((errors) => ({ ...errors, nickname: undefined, nicknameState: undefined }));
  }

  async submit() {
    const errs: Errors = {};
    if (!emailOk(this.email())) errs['email'] = '请输入有效的邮箱地址';
    else if (!NICK_RE.test(this.nickname().trim())) errs['nickname'] = NICK_MSG;
    else if (!pwdValid(this.password())) errs['password'] = '密码至少 8 位，且同时包含字母和数字';
    this.errors.set(errs);
    if (Object.keys(errs).length) return;
    const nickname = this.nickname().trim();
    this.busy.set(true);
    try {
      const t = await this.api.register({
        email: this.email().trim(),
        nickname,
        password: this.password(),
        avatarId: this.avatarId(),
      });
      this.auth.setTokens(t);
      this.password.set('');
      this.feedback.toast(`你好，${t.user.nickname}`);
      const r = this.redirect();
      await this.router.navigateByUrl(r ? safeRedirect(r, '/') : '/create', { replaceUrl: true });
    } catch (e) {
      this.errors.set(fieldErrors(e, nickname !== this.nickname().trim()));
    } finally {
      this.busy.set(false);
    }
  }
}
