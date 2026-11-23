import { Controller } from "@hotwired/stimulus";
import { syncSkinHooks } from "lib/skin_view";
import { fragment, reducedMotion } from "lib/ui";

export default class extends Controller {
  static targets = ["search", "filter", "sort", "sortSelect", "panel", "errorTemplate", "loadingTemplate"];
  static values = { page: Number, filter: String, sort: String, fragment: String };

  connect() {
    this.searchTarget.disabled = false;
    this.sortSelectTarget.disabled = false;
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
    this.showLoading();
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
    const value = currentTarget.dataset.value || currentTarget.value;
    if (this.sortValue === value) return;
    this.sortValue = value;
    this.load(1);
  }

  shortcut(event) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    this.searchTarget.focus();
  }

  page({ currentTarget }) {
    const page = Number(currentTarget.dataset.page);
    if (page === this.pageValue) return;
    this.load(page);
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
    this.showLoading();
    try {
      const html = await fragment(this.fragmentValue + query, signal);
      this.panelTarget.replaceChildren(html);
      syncSkinHooks(this.panelTarget);
      const counts = this.panelTarget.querySelector("[data-plaza-counts]");
      this.filterTargets.forEach((button) => this.setCount(button, counts?.dataset[button.dataset.value]));
    } catch {
      if (!signal.aborted) this.panelTarget.replaceChildren(this.errorTemplateTarget.content.cloneNode(true));
    } finally {
      if (!signal.aborted) this.panelTarget.removeAttribute("aria-busy");
    }
  }

  showLoading() {
    this.panelTarget.setAttribute("aria-busy", "true");
    const cards = this.panelTarget.querySelector(".grid");
    if (this.panelTarget.querySelector("[data-plaza-counts]") && cards) {
      cards.classList.add("is-busy");
      cards.inert = true;
    } else {
      this.panelTarget.replaceChildren(this.loadingTemplateTarget.content.cloneNode(true));
    }
    this.filterTargets.forEach((button) => this.setCount(button, null));
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
    this.sortSelectTarget.value = this.sortValue;
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
