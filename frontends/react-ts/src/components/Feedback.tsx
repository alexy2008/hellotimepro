import { useEffect, useRef, useState } from "react";
import { useFeedback } from "@/stores/feedback";
import { Icon } from "@/lib/icons";

/** 提示条容器：页面底部居中，逐条淡入淡出 */
export function Toasts() {
  const toasts = useFeedback((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          data-tone={t.tone}
          className={`toast toast--${t.tone === "error" ? "err" : t.tone === "info" ? "info" : "ok"}${t.shown ? " is-in" : ""}`}
        >
          <Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "check"} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/** 确认框：焦点圈定在卡片里，Esc 取消，关闭后焦点回到打开前的位置 */
export function DialogHost() {
  const dialog = useFeedback((s) => s.dialog);
  const [shown, setShown] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!dialog) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setShown(true);
        okRef.current?.focus();
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [dialog]);

  if (!dialog) return null;

  function close(ok: boolean) {
    setShown(false);
    prevFocus.current?.focus?.();
    dialog!.resolve(ok);
  }

  return (
    <div className={`dlg${shown ? " is-in" : ""}`}>
      <div className="dlg__scrim" onClick={() => close(false)} />
      <div
        className="dlg__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-t"
        data-testid="confirm-dialog"
        onKeyDown={(e) => {
          // 焦点圈定：Tab 在卡片内循环
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
        }}
      >
        {dialog.mark}
        <h2 id="dlg-t" className="dlg__t">
          {dialog.title}
        </h2>
        {dialog.body ? <div className="dlg__b">{dialog.body}</div> : null}
        <div className="dlg__act">
          <button className="btn btn--ghost" type="button" data-testid="confirm-cancel" onClick={() => close(false)}>
            {dialog.cancel ?? "取消"}
          </button>
          <button
            ref={okRef}
            className={`btn btn--${dialog.tone ?? "primary"}`}
            type="button"
            data-testid="confirm-ok"
            onClick={() => close(true)}
          >
            {dialog.confirm ?? "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}
