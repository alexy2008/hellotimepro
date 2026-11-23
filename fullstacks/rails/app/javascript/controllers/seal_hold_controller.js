import { Controller } from "@hotwired/stimulus";

const HOLD_MS = 900;

export default class extends Controller {
  disconnect() { this.cancel(); }

  prevent(event) { event.preventDefault(); }

  pointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    this.element.focus({ preventScroll: true });
    this.element.setPointerCapture(event.pointerId);
    this.start();
  }

  keyDown(event) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) this.start();
  }

  keyUp(event) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      this.cancel();
    }
  }

  start() {
    if (this.timer || this.element.disabled) return;
    const started = performance.now();
    this.element.classList.add("is-holding");
    this.progress = setInterval(() => {
      this.element.style.setProperty("--hp", Math.min((performance.now() - started) / HOLD_MS, 1));
    }, 24);
    this.timer = setTimeout(() => {
      this.cancel();
      this.element.form?.requestSubmit();
    }, HOLD_MS);
  }

  cancel() {
    clearTimeout(this.timer);
    clearInterval(this.progress);
    this.timer = null;
    this.element.classList.remove("is-holding");
    this.element.style.removeProperty("--hp");
  }
}
