import { Controller } from "@hotwired/stimulus";
import { reducedMotion } from "lib/ui";

export default class extends Controller {
  static targets = ["art"];

  move(event) {
    if (event.pointerType === "touch" || reducedMotion()) return;
    const box = this.element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    this.setPosition(x, y);
  }

  leave() { this.setPosition(0, 0); }

  setPosition(x, y) {
    const style = this.artTarget.style;
    style.setProperty("--mx", x.toFixed(3));
    style.setProperty("--my", y.toFixed(3));
    style.setProperty("--tilt-x", `${(-y * 14).toFixed(2)}deg`);
    style.setProperty("--tilt-y", `${(x * 16).toFixed(2)}deg`);
  }
}
