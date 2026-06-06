import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { text: String, doneLabel: String }

  connect() {
    this.label = this.element.textContent
  }

  copy() {
    const text = this.textValue || window.location.href
    this.write(text)
      .then(() => this.showDone())
      .catch(() => this.showDone())
  }

  write(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
    }

    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.left = "-9999px"
    document.body.appendChild(area)
    area.select()
    document.execCommand("copy")
    area.remove()
    return Promise.resolve()
  }

  showDone() {
    this.element.textContent = this.doneLabelValue || "✓ 已复制!"
    window.clearTimeout(this.resetTimer)
    this.resetTimer = window.setTimeout(() => {
      this.element.textContent = this.label
    }, 2000)
  }
}
