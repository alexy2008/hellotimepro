// ============================================================
// 登录页的页面逻辑，由 LoginPage 提供、两套皮肤注入同一份。
// 表单值就放在这里：切换皮肤（视图整个换掉）时 Facade 还在，值不丢（X5）；
// 离开登录页时它随宿主组件一起销毁，值也就没了；登录成功时主动清空。
// ============================================================

import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { FeedbackStore } from '@/stores/feedback.store';
import { safeRedirect } from '@/lib/redirect';
import { emailOk, type Errors } from '@/lib/account';
import { ApiError } from '@/types';

/** URL 上的 ?redirect= */
export function injectRedirectParam() {
  return toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('redirect') || null)), { initialValue: null });
}

@Injectable()
export class LoginFacade {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly errors = signal<Errors>({});
  readonly busy = signal(false);
  readonly redirect = injectRedirectParam();

  async submit() {
    const email = this.email();
    const password = this.password();
    const errs: Errors = {};
    if (!emailOk(email)) errs['email'] = '请输入有效的邮箱地址';
    else if (!password) errs['password'] = '请输入密码';
    this.errors.set(errs);
    if (Object.keys(errs).length) return;
    this.busy.set(true);
    try {
      const t = await this.api.login({ email: email.trim(), password });
      this.auth.setTokens(t);
      this.email.set('');
      this.password.set('');
      this.feedback.toast(`欢迎回来，${t.user.nickname}`);
      const r = this.redirect();
      await this.router.navigateByUrl(r ? safeRedirect(r, '/') : '/me/created', { replaceUrl: true });
    } catch (e) {
      // 不区分「邮箱不存在」与「密码错误」
      this.errors.set({
        form: e instanceof ApiError && e.status === 401 ? '邮箱或密码不正确' : e instanceof ApiError ? e.message : '网络异常，请稍后再试',
      });
    } finally {
      this.busy.set(false);
    }
  }

  /** 重新输入时收起整表错误 */
  onInput() {
    if (this.errors()['form']) this.errors.set({});
  }
}
