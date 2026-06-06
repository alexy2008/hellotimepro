import { Controller } from "@hotwired/stimulus"

// 广场搜索：输入防抖后提交表单（Turbo Frame 局部替换 #plaza-grid）。
// 注意：监听 input 事件——Playwright 的 fill() 只派发 input，不派发 keyup。
export default class extends Controller {
  static targets = ["form"]

  search() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.formTarget.requestSubmit(), 250)
  }
}
