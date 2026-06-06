import { Controller } from "@hotwired/stimulus"

// 暗/亮主题切换（持久化到 localStorage；首帧由 layout 内联脚本应用避免闪烁）。
export default class extends Controller {
  toggle() {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"
    const next = cur === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", next)
    try { localStorage.setItem("hellotime.theme", next) } catch (e) { /* noop */ }
    const icon = this.element.querySelector("span")
    if (icon) icon.textContent = next === "dark" ? "☾" : "☀"
  }
}
