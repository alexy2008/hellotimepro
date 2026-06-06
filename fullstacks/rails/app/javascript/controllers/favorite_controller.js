import { Controller } from "@hotwired/stimulus"

// 收藏切换：
//  - 匿名：纯客户端 confirm 后跳登录（不发请求）。
//  - 已登录：同步 XHR 切换——保证「点完立刻导航到 /me/favorites」之前收藏已落库提交，
//    消除异步 XHR 在途被导航中止 / 收藏未提交即被下一页查询读到的竞态（见 docs/dev-notes.md §4）。
export default class extends Controller {
  static values = { id: String, anon: Boolean }

  toggle(event) {
    event.preventDefault()
    if (this.anonValue) {
      if (window.confirm("登录后才能收藏，前往登录？")) {
        window.location.assign("/login?from=" + encodeURIComponent(window.location.pathname))
      }
      return
    }
    if (this.busy) return
    this.busy = true
    try {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/ui/capsules/" + this.idValue + "/favorite-toggle", false)
      xhr.setRequestHeader("Accept", "application/json")
      xhr.send()
      if (xhr.status >= 200 && xhr.status < 300) {
        const d = JSON.parse(xhr.responseText)
        this.element.setAttribute("data-favorited", String(d.favorited))
        this.element.classList.toggle("is-active", d.favorited)
        const icon = this.element.querySelector(".cy-fav-icon")
        if (icon) icon.textContent = d.favorited ? "♥" : "♡"
        const count = this.element.querySelector(".cy-fav-count")
        if (count) count.textContent = d.favoriteCount
      }
    } catch (err) {
      /* 静默 */
    } finally {
      this.busy = false
    }
  }
}
