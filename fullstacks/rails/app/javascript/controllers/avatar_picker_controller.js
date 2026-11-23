import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input", "option"];

  choose({ currentTarget }) { this.select(currentTarget); }

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
      option.classList.toggle("is-on", active);
      option.classList.toggle("is-active", active);
    });
  }
}
