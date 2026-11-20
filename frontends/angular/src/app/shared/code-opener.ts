// ============================================================
// 凭码开启：首页就地输码与开启页共用。输满 8 位自动查询，
// 命中后短暂亮一下「对了」再跳到 /capsules/:code；没命中就地提示。
// 用法：在组件的 providers 里提供一份（每个输码框各自一份状态）。
// ============================================================

import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { ApiError } from '@/types';
import { sleep } from '@/lib/fmt';

export type CodeState = '' | 'checking' | 'ok' | 'error';

export const MSG_FORMAT = '胶囊码是 8 位大写字母与数字';
export const MSG_NOT_FOUND = '没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1';

@Injectable()
export class CodeOpener {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly state = signal<CodeState>('');
  readonly error = signal('');
  /** 每次出错加一，输码框据此重播「抖一下」 */
  readonly shake = signal(0);
  /** 当前已输入的码（开启按钮是否可点用） */
  readonly value = signal('');
  private busy = false;

  private fail(msg: string) {
    this.state.set('error');
    this.error.set(msg);
    this.shake.update((n) => n + 1);
  }

  async go(code = this.value()) {
    if (this.busy) return;
    if (code.length !== 8) return this.fail(MSG_FORMAT);
    this.busy = true;
    this.error.set('');
    this.state.set('checking');
    try {
      // 至少停留一小会儿，让「正在查」的波浪被看见
      const [c] = await Promise.all([this.api.capsuleByCode(code), sleep(480)]);
      this.state.set('ok');
      await sleep(260);
      await this.router.navigateByUrl(`/capsules/${c.code}`);
    } catch (e) {
      this.fail(e instanceof ApiError && e.status === 404 ? MSG_NOT_FOUND : '查询失败，请稍后再试');
    } finally {
      this.busy = false;
    }
  }

  /** 用户又开始输入：记下值，清掉错误态 */
  input(v: string) {
    this.value.set(v);
    if (this.state() === 'error') this.state.set('');
    this.error.set('');
  }
}
