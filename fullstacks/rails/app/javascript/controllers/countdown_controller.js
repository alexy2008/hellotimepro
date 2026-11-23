import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { fragment, reducedMotion, sleep } from "lib/ui";

export default class extends Controller {
  static targets = ["digit", "opening"];
  static values = { url: String };

  connect() { this.restart(); }

  disconnect() { this.stop(); }

  restart() {
    this.stop();
    this.cycle = new AbortController();
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
  }

  stop() {
    this.cycle?.abort();
    clearInterval(this.timer);
  }

  tick() {
    const seconds = Math.max(0, Math.ceil((Date.parse(this.element.dataset.openAt) - Date.now()) / 1000));
    const digits = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    this.digitTargets.forEach((target, index) => {
      const digit = String(digits[index]).padStart(2, "0");
      if (target.textContent !== digit) target.textContent = digit;
    });
    if (seconds === 0) {
      clearInterval(this.timer);
      this.waitForServer(this.cycle.signal);
    }
  }

  async waitForServer(signal) {
    this.openingTarget.hidden = false;
    this.element.closest(".detail-main").classList.add("is-unsealing");
    try {
      await sleep(reducedMotion() ? 0 : 420, signal);
      let delay = 1000;
      while (!signal.aborted) {
        try {
          const body = await fragment(this.urlValue, signal);
          if (body.firstElementChild?.dataset.state === "opened" && this.element.isConnected) {
            this.element.closest("turbo-frame").replaceChildren(body);
            return;
          }
        } catch (error) {
          if (error.status === 404 && this.element.isConnected) {
            Turbo.visit(location.pathname, { action: "replace" });
            return;
          }
        }
        await sleep(delay, signal);
        delay = Math.min(delay * 2, 5000);
      }
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }
}
