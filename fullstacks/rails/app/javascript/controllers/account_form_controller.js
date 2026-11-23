import { Controller } from "@hotwired/stimulus";

const VALID_NICKNAME = /^[\p{L}\p{N}_-]{2,20}$/u;

export default class extends Controller {
  static targets = ["nickname", "state", "password", "confirm", "error"];

  nickname() {
    const value = this.nicknameTarget.value;
    if (value) this.showNickname(VALID_NICKNAME.test(value));
    else {
      this.stateTarget.textContent = "";
      delete this.stateTarget.dataset.testid;
      delete this.stateTarget.dataset.state;
      this.nicknameTarget.removeAttribute("aria-invalid");
    }
  }

  validateNickname(event) {
    if (VALID_NICKNAME.test(this.nicknameTarget.value)) return;
    event.preventDefault();
    this.showNickname(false);
    this.nicknameTarget.focus();
  }

  showNickname(valid) {
    this.stateTarget.dataset.testid = "nickname-state";
    this.stateTarget.dataset.state = valid ? "valid" : "invalid";
    this.stateTarget.textContent = valid ? "格式正确" : "昵称需为 2–20 位字母、数字、下划线或连字符";
    this.nicknameTarget.setAttribute("aria-invalid", String(!valid));
  }

  validatePassword(event) {
    if (this.passwordTarget.value === this.confirmTarget.value) return;
    event.preventDefault();
    this.errorTarget.hidden = false;
    this.errorTarget.dataset.testid = "field-error";
    this.confirmTarget.focus();
  }

  clearPasswordError() {
    this.errorTarget.hidden = true;
    delete this.errorTarget.dataset.testid;
  }
}
