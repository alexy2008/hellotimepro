import { Controller } from "@hotwired/stimulus";
import { fragment, reducedMotion } from "lib/ui";

export default class extends Controller {
  static targets = ["search", "filter", "sort", "panel", "errorTemplate"];
  static values = { page: Number, filter: String, sort: String, fragment: String };

  connect() {
    this.searchTarget.disabled = false;
    this.filterTargets.concat(this.sortTargets).forEach((option) => { option.disabled = false; });
    this.updateInput();
    this.updateOptions();
    this.observer = new ResizeObserver(() => this.moveThumbs());
    this.filterTargets.concat(this.sortTargets).forEach((option) => this.observer.observe(option));
  }

  disconnect() {
    clearTimeout(this.debounce);
    this.request?.abort();
    this.observer.disconnect();
  }

  input(event) {
    if (event.isComposing) return;
    this.searchTarget.value = [...this.searchTarget.value].slice(0, 50).join("");
    this.updateInput();
    clearTimeout(this.debounce);
    this.request?.abort();
    this.panelTarget.replaceChildren();
    this.panelTarget.setAttribute("aria-busy", "true");
    this.filterTargets.forEach((button) => this.setCount(button, null));
    this.debounce = setTimeout(() => this.load(1), 260);
  }

  clear() {
    this.searchTarget.value = "";
    this.updateInput();
    this.load(1);
  }

  chooseFilter({ currentTarget }) {
    if (this.filterValue === currentTarget.dataset.value) return;
    this.filterValue = currentTarget.dataset.value;
    this.load(1);
  }

  chooseSort({ currentTarget }) {
    if (this.sortValue === currentTarget.dataset.value) return;
    this.sortValue = currentTarget.dataset.value;
    this.load(1);
  }

  page({ currentTarget }) {
    this.load(Number(currentTarget.dataset.page));
    this.element.scrollIntoView({ behavior: reducedMotion() ? "instant" : "smooth", block: "start" });
  }

  retry() { this.load(this.pageValue); }

  async load(page) {
    clearTimeout(this.debounce);
    this.request?.abort();
    this.pageValue = page;
    const request = new AbortController();
    this.request = request;
    const { signal } = request;
    this.updateOptions();
    const params = new URLSearchParams();
    if (this.filterValue !== "all") params.set("filter", this.filterValue);
    if (this.sortValue !== "new") params.set("sort", this.sortValue);
    if (this.searchTarget.value.trim()) params.set("q", this.searchTarget.value.trim());
    if (page > 1) params.set("page", String(page));
    const query = params.size ? `?${params}` : "";
    // 保留 Turbo 的历史记录键，刷新或登录回跳能重建相同查询。
    history.replaceState(history.state, "", `/${query}`);
    this.panelTarget.replaceChildren();
    this.panelTarget.setAttribute("aria-busy", "true");
    this.filterTargets.forEach((button) => this.setCount(button, null));
    try {
      const html = await fragment(this.fragmentValue + query, signal);
      this.panelTarget.replaceChildren(html);
      const counts = this.panelTarget.querySelector("[data-plaza-counts]");
      this.filterTargets.forEach((button) => this.setCount(button, counts?.dataset[button.dataset.value]));
    } catch {
      if (!signal.aborted) this.panelTarget.replaceChildren(this.errorTemplateTarget.content.cloneNode(true));
    } finally {
      if (!signal.aborted) this.panelTarget.removeAttribute("aria-busy");
    }
  }

  setCount(button, count) {
    const label = button.querySelector("sup");
    if (count == null) {
      delete button.dataset.count;
      label.textContent = "";
    } else {
      button.dataset.count = count;
      label.textContent = count;
    }
  }

  updateInput() { this.searchTarget.closest(".search").classList.toggle("has-value", Boolean(this.searchTarget.value)); }

  updateOptions() {
    for (const [buttons, selected] of [[this.filterTargets, this.filterValue], [this.sortTargets, this.sortValue]]) {
      buttons.forEach((button) => {
        const active = button.dataset.value === selected;
        button.dataset.selected = active;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active);
      });
    }
    this.moveThumbs();
  }

  moveThumbs() {
    for (const button of this.filterTargets.concat(this.sortTargets)) {
      if (button.dataset.selected !== "true") continue;
      const thumb = button.parentElement.querySelector(".seg__thumb");
      thumb.style.width = `${button.offsetWidth}px`;
      thumb.style.transform = `translateX(${button.offsetLeft}px)`;
    }
  }
}
