// ============================================================
// 轻反馈：Toast 与确认框。两套皮肤共用同一份标记（.toast / .dlg），
// 样式各自在 spec/styles/<skin>/components.css 里。
// 页面里直接调用 toast(...) / confirmDialog(...)，不需要往下传回调。
// ============================================================

import { create } from "zustand";
import type { ReactNode } from "react";

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
  shown: boolean;
}

export interface DialogOptions {
  title: string;
  body?: ReactNode;
  confirm?: string;
  cancel?: string;
  /** 确认按钮的样式：primary / danger */
  tone?: "primary" | "danger";
  /** 卡片顶部的小插画，由各皮肤提供 */
  mark?: ReactNode;
}

interface DialogState extends DialogOptions {
  resolve: (ok: boolean) => void;
}

interface FeedbackState {
  toasts: ToastItem[];
  dialog: DialogState | null;
}

export const useFeedback = create<FeedbackState>()(() => ({ toasts: [], dialog: null }));

let seq = 0;

export function toast(msg: string, opt: { tone?: ToastTone; ms?: number } = {}) {
  const id = ++seq;
  const tone = opt.tone ?? "success";
  useFeedback.setState((s) => ({ toasts: [...s.toasts, { id, msg, tone, shown: false }] }));
  // 两帧之后再加 is-in，入场过渡才会生效
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      useFeedback.setState((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, shown: true } : t)) })),
    ),
  );
  setTimeout(() => {
    useFeedback.setState((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, shown: false } : t)) }));
    setTimeout(() => useFeedback.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 400);
  }, opt.ms ?? 2600);
}

/** 打开确认框，用户点确认得到 true，取消 / Esc / 点遮罩得到 false */
export function confirmDialog(opt: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useFeedback.getState().dialog?.resolve(false);
    useFeedback.setState({
      dialog: {
        ...opt,
        resolve: (ok) => {
          useFeedback.setState({ dialog: null });
          resolve(ok);
        },
      },
    });
  });
}

export async function copyText(text: string, okMsg?: string) {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;left:-99px";
    document.body.appendChild(ta);
    try {
      ta.select();
      copied = document.execCommand("copy");
    } catch {
      // 浏览器也可能禁用回退复制。
    } finally {
      ta.remove();
    }
  }
  if (!copied) toast("复制失败，请手动复制", { tone: "error" });
  else if (okMsg) toast(okMsg);
}
