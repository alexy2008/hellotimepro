// ============================================================
// 匿名用户点了需要登录的操作（收藏、创建入口）：先弹确认框，确认后带 ?redirect= 去登录
// （spec/ui/testids.md X7，文案见 spec/ui/copy.md §4）
// ============================================================

import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { FeedbackStore } from '@/stores/feedback.store';
import { loginPath } from '@/lib/redirect';
import { DialogMarkComponent } from '@/shared/dialog-mark.component';

@Injectable({ providedIn: 'root' })
export class LoginPrompt {
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);

  /** 问一句要不要去登录；确认后带着 from 去登录页，返回用户是否确认 */
  async ask(kind: 'favorite' | 'create', from: string): Promise<boolean> {
    const ok = await this.feedback.confirm(
      kind === 'favorite'
        ? {
            title: '登录后才能收藏',
            body: '收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。',
            confirm: '去登录',
            cancel: '再逛逛',
            mark: { component: DialogMarkComponent, inputs: { ch: '藏', icon: 'heart' } },
          }
        : {
            title: '登录后才能写胶囊',
            body: '胶囊会存在你的账号下：之后在「我的」里随时能找到它、复制胶囊码，或者删除它。',
            confirm: '去登录',
            cancel: '再逛逛',
            mark: { component: DialogMarkComponent, inputs: { ch: '缄', icon: 'pen' } },
          },
    );
    if (ok) await this.router.navigateByUrl(loginPath(from));
    return ok;
  }
}
