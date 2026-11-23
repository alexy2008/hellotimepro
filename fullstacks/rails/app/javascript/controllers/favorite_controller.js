import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { api, promptLogin, toast } from "lib/ui";

export default class extends Controller {
  static values = { id: String, signedIn: Boolean };
  static targets = ["count", "label"];
  static pending = new Set();

  async toggle() {
    const id = this.idValue;
    if (!this.signedInValue) {
      const next = await promptLogin("收藏", location.pathname + location.search);
      if (next && this.element.isConnected) Turbo.visit(next);
      return;
    }

    const pending = this.constructor.pending;
    if (pending.has(id)) return;
    pending.add(id);
    const previous = this.element.getAttribute("aria-pressed") === "true";
    const oldCount = Number(this.element.dataset.count);
    const count = previous ? Math.max(0, oldCount - 1) : oldCount + 1;
    this.update(!previous, count);
    try {
      if (previous) {
        await api(`/me/favorites/${id}`, { method: "DELETE" });
        if (this.element.isConnected) toast("已取消收藏");
      } else {
        const result = await api("/me/favorites", { method: "POST", data: { capsuleId: id } });
        this.update(true, result.favoriteCount);
      }
      if (this.element.isConnected) this.dispatch("changed", { detail: { removed: previous } });
    } catch {
      this.update(previous, oldCount);
      if (this.element.isConnected) toast("收藏没有成功，请稍后再试", "error");
    } finally {
      pending.delete(id);
    }
  }

  update(pressed, count) {
    if (!this.element.isConnected) return;
    for (const button of document.querySelectorAll(`[data-favorite-id-value="${this.idValue}"]`)) {
      button.dataset.count = count;
      button.setAttribute("aria-pressed", pressed);
      button.setAttribute("aria-label", pressed ? "取消收藏" : "收藏");
      button.classList.toggle("is-on", pressed);
      button.querySelector('[data-favorite-target="count"]').textContent = count;
      const label = button.querySelector('[data-favorite-target="label"]');
      if (label) label.textContent = pressed ? "已收藏" : "收藏";
    }
    const featured = document.querySelector(`[data-featured-id="${this.idValue}"] [data-featured-count]`);
    if (featured) featured.textContent = count;
  }
}
