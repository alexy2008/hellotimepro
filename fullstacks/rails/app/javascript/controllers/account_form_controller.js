import { Controller } from "@hotwired/stimulus";

const VALID_NICKNAME = /^[\p{L}\p{N}_-]{2,20}$/u;

export default class extends Controller {
  static targets = ["nickname", "state", "current", "password", "confirm", "error", "formError", "rule"];

  passwordRules() {
    const value = this.passwordTarget.value;
    const passes = [Array.from(value).length >= 8, /[a-z]/i.test(value), /[0-9]/.test(value)];
    this.ruleTargets.forEach((rule, index) => rule.classList.toggle("is-ok", passes[index]));
  }

  resetProfile() {
    this.nicknameTarget.value = this.element.dataset.initialNickname;
    this.clearNickname();
    this.clearFormError();
  }

  clearNickname() {
    this.stateTarget.textContent = "";
    delete this.stateTarget.dataset.testid;
    delete this.stateTarget.dataset.state;
    this.nicknameTarget.removeAttribute("aria-invalid");
  }

  clearFormError() {
    if (this.hasFormErrorTarget) this.formErrorTarget.replaceChildren();
  }

  nickname() {
    this.clearFormError();
    const trimmed = this.nicknameTarget.value.trim();
    if (!trimmed) {
      this.clearNickname();
    } else if (Array.from(trimmed).length < 2) {
      delete this.stateTarget.dataset.testid;
      delete this.stateTarget.dataset.state;
      this.stateTarget.textContent = "至少 2 个字符";
      this.nicknameTarget.removeAttribute("aria-invalid");
    } else {
      this.showNickname(VALID_NICKNAME.test(trimmed));
    }
  }

  validateNickname(event) {
    const trimmed = this.nicknameTarget.value.trim();
    if (VALID_NICKNAME.test(trimmed)) return;
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

  showFormError(message) {
    if (!this.hasFormErrorTarget) return;
    const box = document.createElement("div");
    box.className = "form__err";
    box.setAttribute("role", "alert");
    box.textContent = message;
    this.formErrorTarget.replaceChildren(box);
  }

  validatePassword(event) {
    this.clearFormError();
    if (this.hasCurrentTarget && !this.currentTarget.value) {
      event.preventDefault();
      this.showFormError("请输入当前密码");
      this.currentTarget.focus();
      return;
    }
    const next = this.passwordTarget.value;
    const valid = Array.from(next).length >= 8 && /[a-z]/i.test(next) && /[0-9]/.test(next);
    if (!valid) {
      event.preventDefault();
      this.showFormError("新密码至少 8 位，且同时包含字母和数字");
      this.passwordTarget.focus();
      return;
    }
    if (next !== this.confirmTarget.value) {
      event.preventDefault();
      this.errorTarget.hidden = false;
      this.errorTarget.dataset.testid = "field-error";
      this.confirmTarget.focus();
    }
  }

  clearPasswordError() {
    this.errorTarget.hidden = true;
    delete this.errorTarget.dataset.testid;
    this.clearFormError();
  }
}
