import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { api, reducedMotion, sleep, toast } from "lib/ui";

const MISSING = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";
const CLEAN = (value) => String(value ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase().slice(0, 8);

export default class extends Controller {
  static targets = ["input", "cell", "cells", "error", "submit"];

  static values = { autofocus: Boolean };

  connect() {
    this.inputTarget.disabled = false;
    this.display();
    if (this.autofocusValue && matchMedia("(pointer: fine)").matches) this.inputTarget.focus({ preventScroll: true });
  }

  disconnect() { this.lookup?.abort(); }

  cancel() {
    this.lookup?.abort();
    this.lookup = null;
    this.display();
  }

  input(event) {
    if (event?.isComposing) return;
    // 一次输入事件带进完整 8 位码（粘贴、自动填充）时从头覆盖，不接在已有字符后面。
    const chunk = CLEAN(event?.data);
    const value = chunk.length === 8 ? chunk : CLEAN(this.inputTarget.value);
    this.inputTarget.value = value;
    this.cancel();
    if (value.length === 8) this.find(value);
  }

  submit(event) {
    event.preventDefault();
    const code = this.inputTarget.value;
    if (code.length === 8) {
      if (!this.lookup) this.find(code);
    } else {
      this.display("error", "胶囊码是 8 位大写字母与数字");
      this.inputTarget.focus();
    }
  }

  async paste() {
    try {
      const cleaned = CLEAN(await navigator.clipboard.readText());
      if (!cleaned) {
        toast("剪贴板里没有胶囊码", "info");
        return;
      }
      this.inputTarget.value = cleaned;
      this.input();
    } catch {
      this.inputTarget.focus();
      toast("请在输入框中粘贴胶囊码", "info");
    }
  }

  async find(code) {
    const lookup = new AbortController();
    this.lookup = lookup;
    const { signal } = lookup;
    this.display("checking");
    try {
      const [capsule] = await Promise.all([
        api(`/capsules/${code}`, { signal }),
        sleep(reducedMotion() ? 0 : 360, signal),
      ]);
      signal.throwIfAborted();
      this.display("ok");
      await sleep(reducedMotion() ? 0 : 220, signal);
      if (this.element.isConnected) Turbo.visit(`/capsules/${capsule.code}`);
    } catch (error) {
      if (!signal.aborted) this.display("error", error.status === 404 ? MISSING : "暂时无法查询，请重试");
    } finally {
      if (this.lookup === lookup) this.lookup = null;
    }
  }

  display(state, message = "") {
    if (!this.hasInputTarget) return;
    const code = this.inputTarget.value;
    if (this.hasSubmitTarget) {
      this.submitTarget.disabled = code.length < 8 || state === "checking";
      this.submitTarget.classList.toggle("is-busy", state === "checking");
    }
    this.element.classList.toggle("is-full", code.length === 8);
    this.cellTargets.forEach((cell, index) => {
      const character = code[index] || "";
      cell.dataset.value = character;
      cell.textContent = character;
      cell.classList.toggle("is-filled", Boolean(character));
      cell.classList.toggle("is-active", index === code.length);
    });
    for (const kind of ["checking", "ok", "error"]) this.cellsTarget.classList.toggle(`is-${kind}`, kind === state);
    this.errorTarget.textContent = message;
    if (message) this.errorTarget.dataset.testid = "open-error";
    else delete this.errorTarget.dataset.testid;
  }

  focus() { this.cellsTarget.classList.toggle("is-focused", document.activeElement === this.inputTarget); }
}
