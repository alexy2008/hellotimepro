// ============================================================
// 轻反馈：Toast 与确认框。两套皮肤共用同一份标记（.toast / .dlg），
// 样式各自在 spec/styles/<skin>/components.css 里。
// 页面里直接调用 toast(...) / confirmDialog(...)，不需要往下传回调。
//
// 确认框的正文与顶部小插画用「函数式组件」描述（() => VNode），
// DialogHost 用 <component :is> 渲染——内容里的用户文字照常转义，不用 v-html。
// ============================================================

import { defineStore } from "pinia";
import { markRaw, ref, shallowRef, type FunctionalComponent } from "vue";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
  shown: boolean;
}

export interface DialogOptions {
  title: string;
  body?: FunctionalComponent;
  confirm?: string;
  cancel?: string;
  /** 确认按钮的样式：primary / danger */
  tone?: "primary" | "danger";
  /** 卡片顶部的小插画，由各皮肤提供 */
  mark?: FunctionalComponent;
}

export interface DialogState extends DialogOptions {
  resolve: (ok: boolean) => void;
}

let seq = 0;

export const useFeedbackStore = defineStore("feedback", () => {
  const toasts = ref<ToastItem[]>([]);
  const dialog = shallowRef<DialogState | null>(null);

  const patchToast = (id: number, shown: boolean) => {
    const t = toasts.value.find((x) => x.id === id);
    if (t) t.shown = shown;
  };

  function toast(msg: string, opt: { tone?: ToastTone; ms?: number } = {}) {
    const id = ++seq;
    toasts.value.push({ id, msg, tone: opt.tone ?? "success", shown: false });
    // 两帧之后再加 is-in，入场过渡才会生效
    requestAnimationFrame(() => requestAnimationFrame(() => patchToast(id, true)));
    setTimeout(() => {
      patchToast(id, false);
      setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 400);
    }, opt.ms ?? 2600);
  }

  /** 打开确认框，用户点确认得到 true，取消 / Esc / 点遮罩得到 false */
  function confirm(opt: DialogOptions): Promise<boolean> {
    dialog.value?.resolve(false);
    return new Promise((resolve) => {
      const state: DialogState = {
        ...opt,
        body: opt.body && markRaw(opt.body),
        mark: opt.mark && markRaw(opt.mark),
        resolve: (ok) => {
          if (dialog.value === state) dialog.value = null;
          resolve(ok);
        },
      };
      dialog.value = state;
    });
  }

  return { toasts, dialog, toast, confirm };
});

/** 组件外（或不想拿 store 的地方）直接调用 */
export const toast = (msg: string, opt?: { tone?: ToastTone; ms?: number }) => useFeedbackStore().toast(msg, opt);
export const confirmDialog = (opt: DialogOptions) => useFeedbackStore().confirm(opt);

export async function copyText(text: string, okMsg?: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;left:-99px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* 两种方式都失败时只能放弃 */
    }
    ta.remove();
  }
  if (okMsg) toast(okMsg);
}
