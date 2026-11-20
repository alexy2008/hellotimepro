// ============================================================
// 轻反馈：Toast 与确认框。两套皮肤共用同一份标记（.toast / .dlg），
// 样式各自在 spec/styles/<skin>/components.css 里。
//
// 确认框的正文与顶部小插画是「组件 + 输入」：DialogHost 用 *ngComponentOutlet 渲染，
// 用户写的文字走插值、照常转义，不用 innerHTML。
// ============================================================

import type { Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
  shown: boolean;
}

/** 由组件画出来的一块内容：组件类型 + 它的输入 */
export interface Piece {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

export interface DialogOptions {
  title: string;
  /** 正文：一段纯文本，或一个组件 */
  body?: string | Piece;
  confirm?: string;
  cancel?: string;
  /** 确认按钮的样式：primary / danger */
  tone?: 'primary' | 'danger';
  /** 卡片顶部的小插画，由各皮肤提供 */
  mark?: Piece;
}

export interface DialogState extends DialogOptions {
  resolve: (ok: boolean) => void;
}

let seq = 0;

export const FeedbackStore = signalStore(
  { providedIn: 'root' },
  withState({ toasts: [] as ToastItem[], dialog: null as DialogState | null }),
  withMethods((store) => {
    const setShown = (id: number, shown: boolean) =>
      patchState(store, (s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, shown } : t)) }));

    return {
      toast(msg: string, opt: { tone?: ToastTone; ms?: number } = {}) {
        const id = ++seq;
        patchState(store, (s) => ({ toasts: [...s.toasts, { id, msg, tone: opt.tone ?? 'success', shown: false }] }));
        // 两帧之后再加 is-in，入场过渡才会生效
        requestAnimationFrame(() => requestAnimationFrame(() => setShown(id, true)));
        setTimeout(() => {
          setShown(id, false);
          setTimeout(() => patchState(store, (s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 400);
        }, opt.ms ?? 2600);
      },

      /** 打开确认框，用户点确认得到 true，取消 / Esc / 点遮罩得到 false */
      confirm(opt: DialogOptions): Promise<boolean> {
        store.dialog()?.resolve(false);
        return new Promise((resolve) => {
          const state: DialogState = {
            ...opt,
            resolve: (ok) => {
              if (store.dialog() === state) patchState(store, { dialog: null });
              resolve(ok);
            },
          };
          patchState(store, { dialog: state });
        });
      },
    };
  }),
);

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-99px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* 两种方式都失败时只能放弃 */
    }
    ta.remove();
  }
}
