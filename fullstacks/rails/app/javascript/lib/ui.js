export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function api(path, { method = "GET", data, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api/v1${path}`, { method, headers, signal, body: JSON.stringify(data) });
  if (response.status === 204) return;
  const envelope = await response.json();
  if (!response.ok || !envelope.success) {
    throw Object.assign(new Error(envelope.message || "请求失败"), { status: response.status });
  }
  return envelope.data;
}

export async function fragment(path, signal) {
  const response = await fetch(path, { signal, headers: { Accept: "text/html" } });
  if (!response.ok) throw Object.assign(new Error("页面读取失败"), { status: response.status });
  const template = document.createElement("template");
  template.innerHTML = await response.text();
  signal.throwIfAborted();
  return template.content;
}

export function toast(message, tone = "success") {
  const item = document.createElement("div");
  item.className = `toast toast--${{ success: "ok", error: "err", info: "info" }[tone]} is-in`;
  item.dataset.testid = "toast";
  item.dataset.tone = tone;
  item.textContent = message;
  document.getElementById("toasts")?.append(item);
  setTimeout(() => item.remove(), 3500);
}

export function confirmDialog({ title, body, ok, cancel, danger = false }) {
  if (document.querySelector(".dlg")) return Promise.resolve(false);

  const source = document.getElementById("confirm-template").content.firstElementChild;
  const dialog = source.cloneNode(true);
  const previous = document.activeElement;
  const accept = dialog.querySelector('[data-testid="confirm-ok"]');
  const reject = dialog.querySelector('[data-testid="confirm-cancel"]');
  dialog.querySelector("h2").textContent = title;
  dialog.querySelector("p").textContent = body || "";
  dialog.querySelector(".dlg__b").hidden = !body;
  dialog.querySelector("strong").hidden = !danger;
  accept.textContent = ok;
  reject.textContent = cancel;
  if (danger) accept.classList.replace("btn--primary", "btn--danger");

  return new Promise((resolve) => {
    const listeners = new AbortController();
    const { signal } = listeners;
    const close = (result) => {
      listeners.abort();
      dialog.remove();
      previous.focus({ preventScroll: true });
      resolve(result);
    };

    document.addEventListener("turbo:before-render", () => close(false), { signal });
    accept.addEventListener("click", () => close(true), { signal });
    reject.addEventListener("click", () => close(false), { signal });
    dialog.querySelector("[data-dialog-dismiss]").addEventListener("click", () => close(false), { signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      } else if (event.key === "Tab") {
        event.preventDefault();
        (document.activeElement === accept ? reject : accept).focus();
      }
    }, { signal });
    document.body.append(dialog);
    accept.focus();
  });
}

export async function promptLogin(verb, returnTo) {
  const confirmed = await confirmDialog({ title: `登录后才能${verb}`, ok: "去登录", cancel: "再逛逛" });
  return confirmed ? `/login?redirect=${encodeURIComponent(returnTo)}` : null;
}
