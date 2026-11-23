import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input", "option", "caption"];

  static values = { initial: String };

  choose({ currentTarget }) { this.select(currentTarget); }

  reset() {
    const initial = this.optionTargets.find((option) => option.dataset.value === this.initialValue);
    if (initial) this.select(initial);
  }

  move(event) {
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const options = this.optionTargets;
    const button = options[(options.indexOf(event.currentTarget) + direction + options.length) % options.length];
    this.select(button);
    button.focus();
  }

  select(button) {
    this.inputTarget.value = button.dataset.value;
    this.optionTargets.forEach((option) => {
      const active = option === button;
      option.dataset.selected = active;
      option.setAttribute("aria-checked", active);
      option.classList.toggle("is-sel", active);
      option.tabIndex = active ? 0 : -1;
    });
    this.captionTargets.forEach((caption) => { caption.hidden = caption.dataset.value !== this.inputTarget.value; });
  }
}
