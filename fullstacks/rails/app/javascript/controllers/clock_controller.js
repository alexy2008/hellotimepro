import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = { openAt: String };

  connect() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  disconnect() { clearInterval(this.timer); }

  tick() {
    const remaining = Math.max(0, Math.ceil((Date.parse(this.openAtValue) - Date.now()) / 1000));
    const days = Math.floor(remaining / 86400);
    const time = [Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60]
      .map((value) => String(value).padStart(2, "0")).join(":");
    this.element.textContent = days ? `${days} 天 ${time}` : time;
  }
}
