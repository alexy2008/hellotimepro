import { Controller } from "@hotwired/stimulus"

// 用户菜单下拉：点击 chip 开合，点击外部关闭。
export default class extends Controller {
  static targets = ["chip", "dropdown"]

  connect() {
    this.onOutside = this.closeOnOutside.bind(this)
    document.addEventListener("click", this.onOutside)
  }

  disconnect() {
    document.removeEventListener("click", this.onOutside)
  }

  toggle(event) {
    event.stopPropagation()
    const open = this.chipTarget.getAttribute("aria-expanded") === "true"
    this.chipTarget.setAttribute("aria-expanded", String(!open))
    this.dropdownTarget.hidden = open
  }

  closeOnOutside(event) {
    if (this.element.contains(event.target)) return
    this.chipTarget.setAttribute("aria-expanded", "false")
    this.dropdownTarget.hidden = true
  }
}
