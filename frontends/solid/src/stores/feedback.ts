// ============================================================
// 轻反馈：Toast 与确认框。两套皮肤共用同一份标记（.toast / .dlg），
// 样式各自在 spec/styles/<skin>/components.css 里。
// 页面里直接调用 toast(...) / confirmDialog(...)，不需要往下传回调。
// ============================================================

import { createSignal, type JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
  shown: boolean;
}

export interface DialogOptions {
  title: string;
  /**
   * 正文与顶部小插画都写成「返回 JSX 的函数」：由 DialogHost 在自己的组件树里调用。
   * Solid 的 JSX 一写出来就是真实 DOM 节点，若在点击回调里直接创建，
   * 其中的动态表达式没有归属的 owner，既不会被清理也会触发开发期告警。
   */
  body?: () => JSX.Element;
  confirm?: string;
  cancel?: string;
  /** 确认按钮的样式：primary / danger */
  tone?: "primary" | "danger";
  /** 卡片顶部的小插画，由各皮肤提供 */
  mark?: () => JSX.Element;
}

export interface DialogState extends DialogOptions {
  resolve: (ok: boolean) => void;
}

const [toasts, setToasts] = createStore<ToastItem[]>([]);
const [dialog, setDialog] = createSignal<DialogState | null>(null);
export { toasts, dialog };

let seq = 0;

export function toast(msg: string, opt: { tone?: ToastTone; ms?: number } = {}) {
  const id = ++seq;
  const tone = opt.tone ?? "success";
  const show = (shown: boolean) => setToasts((t) => t.id === id, "shown", shown);
  setToasts(produce((list) => void list.push({ id, msg, tone, shown: false })));
  // 两帧之后再加 is-in，入场过渡才会生效
  requestAnimationFrame(() => requestAnimationFrame(() => show(true)));
  setTimeout(() => {
    show(false);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 400);
  }, opt.ms ?? 2600);
}

/** 打开确认框，用户点确认得到 true，取消 / Esc / 点遮罩得到 false */
export function confirmDialog(opt: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    dialog()?.resolve(false);
    setDialog({
      ...opt,
      resolve: (ok) => {
        setDialog(null);
        resolve(ok);
      },
    });
  });
}

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
