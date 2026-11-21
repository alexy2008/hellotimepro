// ============================================================
// 提示条与确认框的宿主：总布局里各挂一次
// ============================================================

import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import { dialog, toasts, type DialogState } from "@/stores/feedback";
import { Icon } from "@/lib/icons";

/** 提示条容器：页面底部居中，逐条淡入淡出 */
export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      <For each={toasts}>
        {(t) => (
          <div
            data-testid="toast"
            data-tone={t.tone}
            class={`toast toast--${t.tone === "error" ? "err" : t.tone === "info" ? "info" : "ok"}${t.shown ? " is-in" : ""}`}
          >
            <Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "check"} />
            <span>{t.msg}</span>
          </div>
        )}
      </For>
    </div>
  );
}

/** 确认框：焦点圈定在卡片里，Esc 取消，关闭后焦点回到打开前的位置 */
export function DialogHost() {
  // keyed：每打开一个新的确认框就重建一次卡片（入场过渡、自动聚焦都重新来）
  return <Show when={dialog()} keyed>{(d) => <DialogCard d={d} />}</Show>;
}

function DialogCard(props: { d: DialogState }) {
  const d = props.d;
  const [shown, setShown] = createSignal(false);
  let ok!: HTMLButtonElement;
  const prevFocus = document.activeElement as HTMLElement | null;

  const close = (yes: boolean) => {
    setShown(false);
    prevFocus?.focus?.();
    d.resolve(yes);
  };

  createEffect(() => {
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setShown(true);
        ok.focus();
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    });
  });

  // 焦点圈定：Tab 在卡片内循环
  const trap = (e: KeyboardEvent & { currentTarget: HTMLDivElement }) => {
    if (e.key !== "Tab") return;
    const f = e.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, textarea");
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div class={`dlg${shown() ? " is-in" : ""}`}>
      <div class="dlg__scrim" onClick={() => close(false)} />
      <div class="dlg__card" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="confirm-dialog" onKeyDown={trap}>
        {d.mark?.()}
        <h2 id="dlg-t" class="dlg__t">
          {d.title}
        </h2>
        <Show when={d.body}>{(body) => <div class="dlg__b">{body()()}</div>}</Show>
        <div class="dlg__act">
          <button class="btn btn--ghost" type="button" data-testid="confirm-cancel" onClick={() => close(false)}>
            {d.cancel ?? "取消"}
          </button>
          <button ref={ok} class={`btn btn--${d.tone ?? "primary"}`} type="button" data-testid="confirm-ok" onClick={() => close(true)}>
            {d.confirm ?? "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}
