import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { clamp, pad } from "lib/date";
import { fragment, reducedMotion, sleep, toast } from "lib/ui";
import { syncSkinHooks } from "lib/skin_view";

const RING = 300 * Math.PI;

export default class extends Controller {
  static values = { url: String, openAt: String, createdAt: String };

  connect() { this.restart(); }

  disconnect() { this.stop(); }

  restart() {
    this.stop();
    syncSkinHooks(this.element);
    if (this.element.dataset.state === "opened") return;
    this.skin = document.documentElement.dataset.skin;
    this.view = this.element.querySelector(`[data-skin-only="${this.skin}"]`);
    this.resetAnimation();
    syncSkinHooks(this.element);
    this.cycle = new AbortController();
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
  }

  stop() {
    this.cycle?.abort();
    clearInterval(this.timer);
  }

  tick() {
    const start = Date.parse(this.createdAtValue);
    const end = Date.parse(this.openAtValue);
    const now = Date.now();
    const seconds = Math.max(0, Math.ceil((end - now) / 1000));
    const digits = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    this.view.querySelectorAll("[data-countdown-unit]").forEach((node, index) => {
      this.updateDigits(node, pad(digits[index]));
    });
    const countdown = this.view.querySelector("[data-open-at]");
    countdown.setAttribute("aria-label", `距离开启还有 ${digits[0]} 天 ${digits[1]} 小时 ${digits[2]} 分 ${digits[3]} 秒`);
    this.updateProgress(end <= start ? 100 : clamp((now - start) * 100 / (end - start), 0, 100));

    if (seconds === 0) {
      clearInterval(this.timer);
      this.waitForServer(this.cycle.signal);
    }
  }

  updateDigits(unit, value) {
    if (this.skin === "paper") {
      if (unit.textContent !== value) unit.textContent = value;
      return;
    }
    const digits = Array.from(unit.children);
    [...value].forEach((digit, index) => {
      if (digits[index]?.textContent === digit) return;
      const tile = document.createElement("span");
      tile.className = "cd__digit";
      tile.textContent = digit;
      if (digits[index]) digits[index].replaceWith(tile);
      else unit.appendChild(tile);
    });
    digits.slice(value.length).forEach((tile) => tile.remove());
  }

  updateProgress(progress) {
    const label = this.view.querySelector("[data-journey-percent]");
    if (this.skin === "paper") {
      const percent = Math.round(progress);
      label.textContent = `已等待 ${percent}%`;
      this.view.querySelector("[data-journey-scale]").style.setProperty("--p", `${percent}%`);
    } else {
      label.textContent = `${progress.toFixed(2)}%`;
      this.view.querySelector("[data-journey-arc]").setAttribute("stroke-dasharray", `${(RING * progress / 100).toFixed(1)} ${RING.toFixed(1)}`);
    }
  }

  resetAnimation() {
    if (this.skin === "paper") {
      this.view.classList.remove("is-opening", "is-leaving");
      this.view.querySelector(".env").classList.remove("is-open", "is-rising");
      this.view.querySelector(".env__seal").classList.remove("is-cracked");
      this.view.querySelector("[data-wax-whole]").hidden = false;
      this.view.querySelectorAll("[data-wax-half]").forEach((half) => { half.hidden = true; });
      this.view.querySelector("[data-opening-label]").textContent = "距离启封还有";
    } else {
      const opening = this.view.querySelector("[data-opening-panel]");
      opening.hidden = true;
      opening.classList.remove("is-open");
      opening.querySelector(".cart").classList.replace("cart--opened", "cart--locked");
      this.view.querySelector("[data-locked-vault]").hidden = false;
    }
  }

  async animate(signal) {
    if (this.skin === "paper") {
      this.view.querySelector("[data-opening-label]").textContent = "时间到了，正在启封…";
      if (reducedMotion()) return;
      this.view.classList.add("is-opening");
      const envelope = this.view.querySelector(".env");
      const seal = envelope.querySelector(".env__seal");
      seal.querySelector("[data-wax-whole]").hidden = true;
      seal.querySelectorAll("[data-wax-half]").forEach((half) => { half.hidden = false; });
      await sleep(60, signal);
      seal.classList.add("is-cracked");
      await sleep(620, signal);
      envelope.classList.add("is-open");
      await sleep(760, signal);
      envelope.classList.add("is-rising");
      await sleep(900, signal);
      this.view.classList.add("is-leaving");
      await sleep(380, signal);
    } else {
      if (reducedMotion()) return;
      const opening = this.view.querySelector("[data-opening-panel]");
      this.view.querySelector("[data-locked-vault]").hidden = true;
      opening.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      await sleep(820, signal);
      opening.classList.add("is-open");
      opening.querySelector(".cart").classList.replace("cart--locked", "cart--opened");
      await sleep(1150, signal);
    }
  }

  async waitForServer(signal) {
    try {
      await this.animate(signal);
      let delay = 1000;
      while (!signal.aborted) {
        try {
          const body = await fragment(this.urlValue, signal);
          const detail = body.firstElementChild;
          if (detail?.dataset.state === "opened" && this.element.isConnected) {
            const letter = detail.querySelector(`[data-skin-only="${this.skin}"] [data-letter]`);
            if (!reducedMotion()) letter.classList.add(this.skin === "paper" ? "letter--reveal" : "is-reveal");
            this.element.closest("turbo-frame").replaceChildren(body);
            window.scrollTo({ top: 0, behavior: reducedMotion() ? "instant" : "smooth" });
            toast(this.skin === "paper" ? "胶囊已启封" : "胶囊已开启");
            return;
          }
        } catch (error) {
          if (error.status === 404 && !signal.aborted) {
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
