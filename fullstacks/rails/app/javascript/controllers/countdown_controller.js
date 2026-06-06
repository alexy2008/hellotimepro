import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["days", "hours", "minutes", "seconds", "compact", "status"]
  static values = { openAt: String, reloadOnExpire: Boolean }

  connect() {
    this.expiredReloaded = false
    this.render()
    this.timer = window.setInterval(() => this.render(), 1000)
  }

  disconnect() {
    if (this.timer) window.clearInterval(this.timer)
  }

  render() {
    const parts = this.parts()
    this.setTarget(this.daysTargets, String(parts.days))
    this.setTarget(this.hoursTargets, this.pad(parts.hours))
    this.setTarget(this.minutesTargets, this.pad(parts.minutes))
    this.setTarget(this.secondsTargets, this.pad(parts.seconds))

    if (this.hasCompactTarget) {
      this.compactTarget.textContent = parts.expired
        ? "正在开启…"
        : `⏳ 还剩 ${parts.days} 天 · ${this.pad(parts.hours)}:${this.pad(parts.minutes)}:${this.pad(parts.seconds)}`
    }

    if (this.hasStatusTarget && parts.expired) {
      this.statusTarget.textContent = "正在同步开启状态…"
    }

    if (parts.expired && this.reloadOnExpireValue && !this.expiredReloaded) {
      this.expiredReloaded = true
      window.setTimeout(() => window.location.reload(), 800)
    }
  }

  parts() {
    const target = new Date(this.openAtValue).getTime()
    const diff = Number.isFinite(target) ? Math.max(0, Math.floor((target - Date.now()) / 1000)) : 0
    return {
      days: Math.floor(diff / 86400),
      hours: Math.floor((diff % 86400) / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
      expired: Number.isFinite(target) && diff <= 0,
    }
  }

  pad(value) {
    return String(value).padStart(2, "0")
  }

  setTarget(targets, value) {
    targets.forEach((target) => {
      target.textContent = value
    })
  }
}
