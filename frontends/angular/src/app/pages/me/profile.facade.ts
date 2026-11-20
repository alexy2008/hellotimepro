// ============================================================
// 「账号设置」：资料（昵称、头像）与改密码。由 MePage 提供：切皮肤不丢正在改的值；
// 切到别的页签或离开「我的」时清空（前者靠下面的 effect，后者靠宿主销毁）。
// ============================================================

import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { FeedbackStore } from '@/stores/feedback.store';
import { type Errors, type FormMsg, NICK_MSG, NICK_RE, nickState, pwdValid } from '@/lib/account';
import { injectAvatarIds } from '@/shared/avatar-ids';
import type { NickStateValue } from '@/shared/nick-state.component';
import { ApiError } from '@/types';
import { fieldErrors } from '../register/register.facade';
import { MeFacade } from './me.facade';

@Injectable()
export class ProfileFacade {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);
  private readonly me = inject(MeFacade);

  readonly user = computed(() => this.auth.user()!);
  readonly nickname = signal('');
  readonly avatarId = signal('');
  readonly pwdCurrent = signal('');
  readonly pwdNext = signal('');
  readonly pwdConfirm = signal('');
  readonly errors = signal<Errors>({});
  readonly busy = signal(false);
  readonly msg = signal<FormMsg>(null);
  readonly pwdBusy = signal(false);
  readonly pwdMsg = signal<FormMsg>(null);
  readonly avatarIds = injectAvatarIds();

  /** 昵称右侧的状态点：没改动时不显示 */
  readonly nick = computed<NickStateValue>(() =>
    this.errors()['nickname'] ? 'taken' : this.nickname().trim() === this.user()?.nickname ? '' : nickState(this.nickname()).state,
  );
  readonly nickHint = computed(() => nickState(this.nickname()).hint);

  constructor() {
    // 进入「账号设置」（或换了账号）时从当前用户填好；离开这个页签时清空
    effect(() => {
      const onTab = this.me.tab() === 'profile';
      this.auth.user()?.id;
      untracked(() => (onTab ? this.fillIfNew() : this.clear()));
    });
  }

  private filledFor: string | null = null;

  private fillIfNew() {
    const u = this.auth.user();
    if (!u || this.filledFor === u.id) return;
    this.filledFor = u.id;
    this.nickname.set(u.nickname);
    this.avatarId.set(u.avatarId);
  }

  private clear() {
    this.filledFor = null;
    for (const s of [this.nickname, this.avatarId, this.pwdCurrent, this.pwdNext, this.pwdConfirm]) s.set('');
    this.errors.set({});
    this.msg.set(null);
    this.pwdMsg.set(null);
  }

  /** 写一个字段，顺手收起它的错误 */
  set(k: 'nickname' | 'current' | 'next' | 'confirm', v: string) {
    ({ nickname: this.nickname, current: this.pwdCurrent, next: this.pwdNext, confirm: this.pwdConfirm })[k].set(v);
    if (this.errors()[k]) this.errors.update((e) => ({ ...e, [k]: undefined }));
  }

  async saveProfile() {
    this.msg.set(null);
    this.errors.set({});
    const u = this.user();
    const patch: { nickname?: string; avatarId?: string } = {};
    if (this.nickname().trim() !== u.nickname) patch.nickname = this.nickname().trim();
    if (this.avatarId() !== u.avatarId) patch.avatarId = this.avatarId();
    if (!Object.keys(patch).length) {
      this.feedback.toast('没有需要保存的修改', { tone: 'info' });
      this.msg.set({ type: 'info', text: '没有改动' });
      return;
    }
    if (patch.nickname != null && !NICK_RE.test(patch.nickname)) {
      this.errors.set({ nickname: NICK_MSG });
      return;
    }
    this.busy.set(true);
    try {
      await this.api.updateProfile(patch);
      await this.auth.refreshMe();
      this.msg.set({ type: 'ok', text: '已保存' });
      this.feedback.toast('资料已更新');
      this.me.refresh();
    } catch (e) {
      const errs = fieldErrors(e);
      this.errors.set(errs);
      if (errs['form']) this.msg.set({ type: 'err', text: errs['form'] });
    } finally {
      this.busy.set(false);
    }
  }

  resetProfile() {
    this.filledFor = null;
    this.fillIfNew();
    this.errors.set({});
    this.msg.set(null);
  }

  async changePassword() {
    this.pwdMsg.set(null);
    const errs: Errors = {};
    if (!this.pwdCurrent()) errs['current'] = '请输入当前密码';
    else if (!pwdValid(this.pwdNext())) errs['next'] = '新密码至少 8 位，且同时包含字母和数字';
    else if (this.pwdNext() !== this.pwdConfirm()) errs['confirm'] = '两次输入的新密码不一致';
    this.errors.set(errs);
    if (Object.keys(errs).length) return;
    this.pwdBusy.set(true);
    try {
      await this.api.changePassword({ currentPassword: this.pwdCurrent(), newPassword: this.pwdNext() });
      for (const s of [this.pwdCurrent, this.pwdNext, this.pwdConfirm]) s.set('');
      this.pwdMsg.set({ type: 'ok', text: '密码已更新。3 秒后将自动登出，请用新密码重新登录。' });
      setTimeout(() => void this.auth.logout(false).then(() => this.router.navigateByUrl('/login')), 3000);
    } catch (e) {
      this.pwdBusy.set(false);
      this.errors.set({ current: e instanceof ApiError ? e.message : '修改失败，请稍后再试' });
    }
  }
}
