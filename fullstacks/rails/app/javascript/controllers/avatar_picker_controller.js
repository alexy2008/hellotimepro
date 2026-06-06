import { Controller } from "@hotwired/stimulus"

// 头像选择器：点选某项 → 高亮 + 写入隐藏字段（注册 / 资料页）。
export default class extends Controller {
  static targets = ["input", "item"]

  select(event) {
    const btn = event.currentTarget
    this.itemTargets.forEach((b) => {
      b.classList.remove("is-selected")
      b.setAttribute("aria-checked", "false")
    })
    btn.classList.add("is-selected")
    btn.setAttribute("aria-checked", "true")
    if (this.hasInputTarget) this.inputTarget.value = btn.dataset.avatarId
  }
}
