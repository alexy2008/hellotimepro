import { Controller } from "@hotwired/stimulus"

// 8 位胶囊码输入：自动跳格 / 退格回退 / 粘贴铺满 / 集齐后跳转 /c/CODE。
export default class extends Controller {
  static targets = ["box"]

  collect() {
    return this.boxTargets.map((i) => i.value).join("")
  }

  maybeGo() {
    const code = this.collect()
    if (code.length === 8 && /^[A-Z0-9]{8}$/.test(code)) window.location.assign("/c/" + code)
  }

  onInput(event) {
    const inp = event.currentTarget
    inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 1)
    const idx = this.boxTargets.indexOf(inp)
    if (inp.value && idx < this.boxTargets.length - 1) this.boxTargets[idx + 1].focus()
    this.maybeGo()
  }

  onKeydown(event) {
    const inp = event.currentTarget
    const idx = this.boxTargets.indexOf(inp)
    if (event.key === "Backspace" && !inp.value && idx > 0) this.boxTargets[idx - 1].focus()
    else if (event.key === "ArrowLeft" && idx > 0) this.boxTargets[idx - 1].focus()
    else if (event.key === "ArrowRight" && idx < this.boxTargets.length - 1) this.boxTargets[idx + 1].focus()
  }

  onPaste(event) {
    event.preventDefault()
    const t = (event.clipboardData.getData("text") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
    this.boxTargets.forEach((b, k) => { b.value = t[k] || "" })
    this.boxTargets[Math.min(t.length, this.boxTargets.length - 1)].focus()
    this.maybeGo()
  }

  submit() {
    this.maybeGo()
  }
}
