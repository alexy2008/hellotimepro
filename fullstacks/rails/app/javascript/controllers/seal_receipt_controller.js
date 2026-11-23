import { Controller } from "@hotwired/stimulus";
import { syncSkinHooks } from "lib/skin_view";
import { reducedMotion, sleep } from "lib/ui";

export default class extends Controller {
  connect() { this.show(); }

  disconnect() { this.animation?.abort(); }

  async show() {
    this.animation?.abort();
    this.animation = new AbortController();
    const { signal } = this.animation;
    syncSkinHooks(this.element);
    const receipt = this.element.querySelector('[data-testid="sealed-receipt"]');
    const paper = receipt.classList.contains("cer");

    try {
      if (!reducedMotion()) {
        if (paper) {
          const envelope = receipt.querySelector(".env");
          receipt.classList.remove("is-in", "is-stamped", "is-done");
          envelope.classList.add("is-open", "is-rising");
          await sleep(30, signal);
          receipt.classList.add("is-in");
          await sleep(520, signal);
          envelope.classList.remove("is-rising");
          await sleep(760, signal);
          envelope.classList.remove("is-open");
          await sleep(780, signal);
          receipt.classList.add("is-stamped");
          await sleep(720, signal);
          receipt.classList.add("is-done");
        } else {
          const art = receipt.querySelector(".cart");
          receipt.classList.remove("is-in");
          art.classList.replace("cart--locked", "cart--opened");
          await sleep(32, signal);
          receipt.classList.add("is-in");
          art.classList.replace("cart--opened", "cart--locked");
        }
      } else {
        receipt.classList.add("is-in");
        if (paper) receipt.classList.add("is-stamped", "is-done");
        receipt.querySelector(".env")?.classList.remove("is-open", "is-rising");
      }

      if (!paper) window.scrollTo({ top: 0, behavior: reducedMotion() ? "instant" : "smooth" });
      receipt.querySelector('[data-testid="copy-code"]')?.focus({ preventScroll: true });
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }
}
