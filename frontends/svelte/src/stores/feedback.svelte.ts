// ============================================================
// 轻反馈：Toast 与确认框。两套皮肤共用同一份标记（.toast / .dlg），
// 样式各自在 spec/styles/<skin>/components.css 里。
// 页面里直接调用 toast(...) / confirmDialog(...)，不需要往下传回调。
//
// 确认框的正文与顶部小插画是「组件 + props」：DialogHost 直接把组件当值渲染，
// 用户写的文字走插值、照常转义，不用 {@html}。
// ============================================================

import type { Component } from "svelte";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
  shown: boolean;
}

/** 由组件画出来的一块内容 */
export interface Piece {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>;
  props?: Record<string, unknown>;
}

export interface DialogOptions {
  title: string;
  /** 正文：一段纯文本，或一个组件 */
  body?: string | Piece;
  confirm?: string;
  cancel?: string;
  /** 确认按钮的样式：primary / danger */
  tone?: "primary" | "danger";
  /** 卡片顶部的小插画，由各皮肤提供 */
  mark?: Piece;
}

export interface DialogState extends DialogOptions {
  resolve: (ok: boolean) => void;
}

let seq = 0;

class Feedback {
  toasts = $state<ToastItem[]>([]);
  dialog = $state.raw<DialogState | null>(null);

  toast(msg: string, opt: { tone?: ToastTone; ms?: number } = {}) {
    const id = ++seq;
    this.toasts.push({ id, msg, tone: opt.tone ?? "success", shown: false });
    const setShown = (shown: boolean) => {
      const t = this.toasts.find((x) => x.id === id);
      if (t) t.shown = shown;
    };
    // 两帧之后再加 is-in，入场过渡才会生效
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    setTimeout(() => {
      setShown(false);
      setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 400);
    }, opt.ms ?? 2600);
  }

  /** 打开确认框，用户点确认得到 true，取消 / Esc / 点遮罩得到 false */
  confirm(opt: DialogOptions): Promise<boolean> {
    this.dialog?.resolve(false);
    return new Promise((resolve) => {
      const state: DialogState = {
        ...opt,
        resolve: (ok) => {
          if (this.dialog === state) this.dialog = null;
          resolve(ok);
        },
      };
      this.dialog = state;
    });
  }
}

export const feedback = new Feedback();
export const toast = (msg: string, opt?: { tone?: ToastTone; ms?: number }) => feedback.toast(msg, opt);
export const confirmDialog = (opt: DialogOptions) => feedback.confirm(opt);

export async function copyText(text: string, okMsg?: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;left:-99px";
    document.body.appendChild(ta);
    ta.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      /* 浏览器可能禁用兼容复制。 */
    } finally {
      ta.remove();
    }
    if (!copied) {
      toast("复制失败，请手动复制", { tone: "error" });
      return;
    }
  }
  if (okMsg) toast(okMsg);
}

/** 复制胶囊码与分享链接（回执、详情页、「我创建的」） */
export const share = {
  code: (code: string) => void copyText(code, `已复制胶囊码 ${code}`),
  link: (code: string) => void copyText(`${location.origin}/capsules/${code}`, "已复制分享链接"),
};
