import { Controller } from "@hotwired/stimulus"

// 资料页：保存昵称/头像（PATCH /api/v1/me，仅提交有改动的字段）、改密（前端两次一致校验 + POST）。
export default class extends Controller {
  static targets = ["profileForm", "nick", "msg", "oldPwd", "newPwd", "confirmPwd", "pwdMsg"]

  reset() {
    window.location.reload()
  }

  save(event) {
    event.preventDefault()
    const form = event.currentTarget
    const nick = this.hasNickTarget ? this.nickTarget.value : ""
    const selected = form.querySelector(".cy-avatar-picker__item.is-selected")
    const avatarId = selected ? selected.dataset.avatarId : null
    const origNick = form.dataset.origNick
    const origAvatar = form.dataset.origAvatar

    const patch = {}
    if (nick !== origNick) patch.nickname = nick.trim()
    if (avatarId && avatarId !== origAvatar) patch.avatarId = avatarId
    if (Object.keys(patch).length === 0) { this.showMsg(this.msgTarget, "info", "没有改动"); return }

    fetch("/api/v1/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(patch),
    })
      .then((r) => r.json().then((env) => ({ ok: r.ok, env })))
      .then((res) => {
        if (res.ok && res.env.success) {
          this.showMsg(this.msgTarget, "success", "已保存")
          form.dataset.origNick = res.env.data.nickname
          form.dataset.origAvatar = res.env.data.avatarId
        } else {
          this.showMsg(this.msgTarget, "danger", (res.env && res.env.message) || "保存失败")
        }
      })
      .catch(() => this.showMsg(this.msgTarget, "danger", "保存失败"))
  }

  changePassword(event) {
    event.preventDefault()
    const oldP = this.hasOldPwdTarget ? this.oldPwdTarget.value : ""
    const newP = this.hasNewPwdTarget ? this.newPwdTarget.value : ""
    const conf = this.hasConfirmPwdTarget ? this.confirmPwdTarget.value : ""
    if (newP !== conf) { this.showMsg(this.pwdMsgTarget, "danger", "两次输入的新密码不一致"); return }

    fetch("/api/v1/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ currentPassword: oldP, newPassword: newP }),
    })
      .then((r) => {
        if (r.status === 204) {
          this.showMsg(this.pwdMsgTarget, "success", "密码已更新，3 秒后将自动登出。")
          setTimeout(() => {
            const lf = document.getElementById("logout-form")
            if (lf && lf.requestSubmit) lf.requestSubmit()
            else window.location.assign("/login")
          }, 3000)
        } else {
          r.json().then((env) => this.showMsg(this.pwdMsgTarget, "danger", (env && env.message) || "修改失败"))
        }
      })
      .catch(() => this.showMsg(this.pwdMsgTarget, "danger", "修改失败"))
  }

  showMsg(el, variant, text) {
    if (!el) return
    const icon = variant === "danger" ? "⚠" : variant === "success" ? "✓" : "ⓘ"
    el.innerHTML = '<div class="cy-alert cy-alert--' + variant + '"><span>' + icon + "</span><span>" + text + "</span></div>"
  }
}
