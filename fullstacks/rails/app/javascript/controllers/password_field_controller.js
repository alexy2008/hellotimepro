import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input"];

  toggle({ currentTarget }) {
    const visible = this.inputTarget.type === "password";
    this.inputTarget.type = visible ? "text" : "password";
    currentTarget.setAttribute("aria-label", visible ? "隐藏密码" : "显示密码");
    currentTarget.setAttribute("aria-pressed", String(visible));
  }
}
