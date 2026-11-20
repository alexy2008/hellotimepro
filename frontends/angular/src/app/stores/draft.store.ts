// ============================================================
// 创建页草稿：标题 / 正文 / 开启时刻 / 是否公开，只放在内存里。
// 切换皮肤、离开再回来都接着写；封存成功、登出、换了账号时清空——草稿属于写它的那个人。
// ============================================================

import { effect, inject, untracked } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { PRESET_AT } from '@/lib/schedule';
import { AuthStore } from '@/stores/auth.store';

interface Draft {
  title: string;
  content: string;
  openAt: number;
  /** 当前选中的预设；用标尺 / 日历 / AI 改了时刻后为 null */
  preset: string | null;
  inPlaza: boolean;
}

const fresh = (): Draft => ({ title: '', content: '', openAt: PRESET_AT['1y'](), preset: '1y', inPlaza: true });

export const DraftStore = signalStore(
  { providedIn: 'root' },
  withState<Draft>(fresh()),
  withMethods((store) => ({
    patch: (p: Partial<Draft>) => patchState(store, p),
    reset: () => patchState(store, fresh()),
  })),
  withHooks({
    onInit(store) {
      // 登出、登录态失效、换了另一个账号时一律清空，
      // 免得同一标签页里下一位用户读到（甚至以自己的身份封存）上一位的草稿
      const auth = inject(AuthStore);
      let prev = auth.user()?.id;
      effect(() => {
        const id = auth.user()?.id;
        untracked(() => {
          if (prev && id !== prev) store.reset();
          prev = id;
        });
      });
    },
  }),
);
