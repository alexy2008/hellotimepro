import { Controller } from "@hotwired/stimulus"

// 创建页增强：快速预设时间、本地时间→ISO（隐藏字段始终同步）、AI 灵感推荐与生成。
// AI 端点走同源 /api/v1 JSON（cookie→Bearer 桥鉴权）；逻辑对齐 React CreatePage / spring-mvc app.js。
export default class extends Controller {
  static targets = ["title", "content", "openVisible", "openHidden", "aiBtn", "recoArea", "picker"]

  connect() {
    this.recos = []
    this.aiGenerated = false
    this.recoSeq = 0
    this.pickerOpen = false
    this.pickerPlacement = "below"
    this.pickerMaxHeight = 460
    if (this.hasOpenVisibleTarget && !this.openVisibleTarget.value && !this.openHiddenTarget.value) {
      this.openVisibleTarget.value = this.presetTime("1h")
    }
    this.pickerDraft = this.localInputToDate(this.openVisibleTarget.value)
    this.pickerViewMonth = new Date(this.pickerDraft.getFullYear(), this.pickerDraft.getMonth(), 1)
    this.onPickerClick = (event) => this.handlePickerClick(event)
    this.onPickerChange = (event) => this.handlePickerChange(event)
    this.onPickerKeydown = (event) => this.handlePickerKeydown(event)
    this.onDocumentPointerdown = (event) => {
      if (this.pickerOpen && this.hasPickerTarget && !this.pickerTarget.contains(event.target)) {
        this.pickerOpen = false
        this.renderPicker()
      }
    }
    this.onViewportMove = () => this.updatePickerPlacement()
    if (this.hasPickerTarget) {
      this.pickerTarget.addEventListener("click", this.onPickerClick)
      this.pickerTarget.addEventListener("change", this.onPickerChange)
      this.pickerTarget.addEventListener("keydown", this.onPickerKeydown)
      document.addEventListener("pointerdown", this.onDocumentPointerdown)
      window.addEventListener("resize", this.onViewportMove)
      window.addEventListener("scroll", this.onViewportMove, true)
      this.renderPicker()
    }
    this.syncHidden()
    this.updateAiBtn()
    this.loadRecos()
  }

  disconnect() {
    if (this.hasPickerTarget) {
      this.pickerTarget.removeEventListener("click", this.onPickerClick)
      this.pickerTarget.removeEventListener("change", this.onPickerChange)
      this.pickerTarget.removeEventListener("keydown", this.onPickerKeydown)
    }
    document.removeEventListener("pointerdown", this.onDocumentPointerdown)
    window.removeEventListener("resize", this.onViewportMove)
    window.removeEventListener("scroll", this.onViewportMove, true)
  }

  isoToLocalInput(date) {
    const tz = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - tz).toISOString().slice(0, 16)
  }

  presetTime(spec) {
    const now = new Date()
    switch (spec) {
      case "1m": now.setSeconds(now.getSeconds() + 130); break
      case "1h": now.setHours(now.getHours() + 1); break
      case "tomorrow9": now.setDate(now.getDate() + 1); now.setHours(9, 0, 0, 0); break
      case "1y": now.setFullYear(now.getFullYear() + 1); break
      case "y2030": return "2030-01-01T00:00"
    }
    return this.isoToLocalInput(now)
  }

  preset(event) {
    if (!this.hasOpenVisibleTarget) return
    this.openVisibleTarget.value = this.presetTime(event.currentTarget.dataset.preset)
    this.syncPickerFromInput()
    this.syncHidden()
  }

  onOpenChange() {
    this.syncPickerFromInput()
    this.syncHidden()
  }

  onSubmit() {
    this.syncHidden()
  }

  syncHidden() {
    if (!this.hasOpenVisibleTarget || !this.hasOpenHiddenTarget) return
    const d = new Date(this.openVisibleTarget.value)
    this.openHiddenTarget.value = isNaN(d.getTime()) ? "" : d.toISOString()
  }

  // ---- DateTimePicker ----
  pad2(n) {
    return (n < 10 ? "0" : "") + n
  }

  localInputToDate(value) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
    const fallback = new Date()
    fallback.setSeconds(0, 0)
    return fallback
  }

  toLocalValue(date) {
    return `${date.getFullYear()}-${this.pad2(date.getMonth() + 1)}-${this.pad2(date.getDate())}T${this.pad2(date.getHours())}:${this.pad2(date.getMinutes())}`
  }

  formatPickerDisplay(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${this.pad2(date.getHours())}:${this.pad2(date.getMinutes())}`
  }

  formatPickerDistance(date) {
    const diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000)
    if (diffMinutes <= 0) return "已到开启时刻"
    if (diffMinutes < 60) return `距开启 ${diffMinutes} 分钟`
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    if (hours < 24) return `距开启 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`
    const days = Math.floor(hours / 24)
    const restHours = hours % 24
    if (days < 365) return `距开启 ${days} 天${restHours ? ` ${restHours} 小时` : ""}`
    const years = Math.floor(days / 365)
    const restDays = days % 365
    return `距开启 ${years} 年${restDays ? ` ${restDays} 天` : ""}`
  }

  daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
  }

  firstWeekdayFromMonday(year, month) {
    return (new Date(year, month, 1).getDay() + 6) % 7
  }

  pickerPresetDate(spec) {
    const next = new Date()
    next.setSeconds(0, 0)
    switch (spec) {
      case "1m": next.setMinutes(next.getMinutes() + 2); return next
      case "1h": next.setHours(next.getHours() + 1); return next
      case "tomorrow9": next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0); return next
      case "1y": next.setFullYear(next.getFullYear() + 1); return next
      case "y2030": return new Date(2030, 0, 1, 0, 0, 0, 0)
      default: return next
    }
  }

  syncPickerFromInput() {
    if (!this.hasOpenVisibleTarget) return
    this.pickerDraft = this.localInputToDate(this.openVisibleTarget.value)
    this.pickerViewMonth = new Date(this.pickerDraft.getFullYear(), this.pickerDraft.getMonth(), 1)
    this.renderPicker()
  }

  commitPickerDraft(next) {
    this.pickerDraft = next
    this.pickerViewMonth = new Date(next.getFullYear(), next.getMonth(), 1)
    this.renderPicker()
  }

  updatePickerPlacement() {
    if (!this.hasPickerTarget) return
    const popover = this.pickerTarget.querySelector(".cy-dtp__popover")
    if (!popover) return
    const gap = 8
    const rect = this.pickerTarget.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const popoverHeight = popover.offsetHeight
    this.pickerPlacement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "above" : "below"
    this.pickerMaxHeight = Math.max(160, Math.min(460, Math.floor(this.pickerPlacement === "above" ? spaceAbove : spaceBelow)))
    popover.classList.toggle("cy-dtp__popover--above", this.pickerPlacement === "above")
    popover.classList.toggle("cy-dtp__popover--below", this.pickerPlacement === "below")
    popover.style.setProperty("--cy-dtp-max-height", `${this.pickerMaxHeight}px`)
  }

  renderPicker() {
    if (!this.hasPickerTarget || !this.hasOpenVisibleTarget) return
    const inputDate = this.localInputToDate(this.openVisibleTarget.value)
    const year = this.pickerViewMonth.getFullYear()
    const month = this.pickerViewMonth.getMonth()
    const parts = {
      year: String(this.pickerDraft.getFullYear()),
      month: this.pad2(this.pickerDraft.getMonth() + 1),
      day: this.pad2(this.pickerDraft.getDate()),
      hour: this.pad2(this.pickerDraft.getHours()),
      minute: this.pad2(this.pickerDraft.getMinutes()),
    }
    let html = `<button id="open_at_trigger" type="button" class="cy-dtp__trigger" aria-haspopup="dialog" aria-expanded="${this.pickerOpen}"><span class="cy-dtp__trigger-icon" aria-hidden="true">⏱</span><span class="cy-dtp__trigger-main"><span class="cy-dtp__trigger-value">${this.formatPickerDisplay(inputDate)}<span class="cy-dtp__trigger-hint">${this.formatPickerDistance(inputDate)}</span></span></span><span class="cy-dtp__trigger-chevron" aria-hidden="true">⌄</span></button>`
    if (this.pickerOpen) {
      html += `<div class="cy-dtp__popover cy-dtp__popover--${this.pickerPlacement}" style="--cy-dtp-max-height:${this.pickerMaxHeight}px" role="dialog" aria-labelledby="open_at_title"><div class="cy-dtp__topbar"><div class="cy-dtp__summary"><span id="open_at_title" class="cy-dtp__eyebrow">选择开启时刻</span><strong>${this.formatPickerDistance(this.pickerDraft)}</strong></div><div class="cy-dtp__manual" aria-label="手动输入开启时间"><input aria-label="年份" inputmode="numeric" data-part="year" value="${parts.year}"><span>年</span><input aria-label="月份" inputmode="numeric" data-part="month" value="${parts.month}"><span>月</span><input aria-label="日期" inputmode="numeric" data-part="day" value="${parts.day}"><span>日</span><input aria-label="小时" inputmode="numeric" data-part="hour" value="${parts.hour}"><span>:</span><input aria-label="分钟" inputmode="numeric" data-part="minute" value="${parts.minute}"></div><div class="cy-dtp__actions"><button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-dtp-cancel>取消</button><button type="button" class="cy-btn cy-btn--primary cy-btn--sm" data-dtp-confirm>确认</button></div></div><div class="cy-dtp__panel"><div class="cy-dtp__calendar"><div class="cy-dtp__monthbar"><button type="button" aria-label="上个月" data-month="-1">‹</button><strong>${year}年${month + 1}月</strong><button type="button" aria-label="下个月" data-month="1">›</button></div><div class="cy-dtp__weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="cy-dtp__days">`
      for (let b = 0; b < this.firstWeekdayFromMonday(year, month); b++) html += '<span aria-hidden="true"></span>'
      for (let d = 1; d <= this.daysInMonth(year, month); d++) {
        const selected = this.pickerDraft.getFullYear() === year && this.pickerDraft.getMonth() === month && this.pickerDraft.getDate() === d
        const today = new Date()
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
        html += `<button type="button" data-day="${d}" class="${selected ? "is-selected " : ""}${isToday ? "is-today" : ""}" aria-pressed="${selected}">${d}</button>`
      }
      html += '</div></div><div class="cy-dtp__time"><label>小时<select class="cy-select" data-time="hour">'
      for (let h = 0; h < 24; h++) html += `<option value="${h}"${this.pickerDraft.getHours() === h ? " selected" : ""}>${this.pad2(h)}</option>`
      html += '</select></label><label>分钟<select class="cy-select" data-time="minute">'
      for (let mi = 0; mi < 60; mi += 5) html += `<option value="${mi}"${this.pickerDraft.getMinutes() === mi ? " selected" : ""}>${this.pad2(mi)}</option>`
      const hourAngle = (this.pickerDraft.getHours() % 12) * 30 + this.pickerDraft.getMinutes() * 0.5
      const minuteAngle = this.pickerDraft.getMinutes() * 6
      html += `</select></label><div class="cy-dtp__clock" aria-label="标准时钟表盘" style="--cy-dtp-clock-hour-angle:${hourAngle}deg;--cy-dtp-clock-minute-angle:${minuteAngle}deg"><span class="cy-dtp__clock-hand cy-dtp__clock-hand--hour" aria-hidden="true"></span><span class="cy-dtp__clock-hand cy-dtp__clock-hand--minute" aria-hidden="true"></span><span class="cy-dtp__clock-center" aria-hidden="true"></span>`
      for (let ch = 1; ch <= 12; ch++) html += `<span class="${this.pickerDraft.getHours() % 12 === ch % 12 ? "is-active" : ""}" aria-label="${ch} 点" style="transform:rotate(${ch * 30}deg) translateY(-38px) rotate(${-ch * 30}deg)">${ch}</span>`
      html += '</div></div></div><div class="cy-dtp__presets" aria-label="快速预设"><button type="button" data-dtp-preset="1m">1分钟后</button><button type="button" data-dtp-preset="1h">1小时后</button><button type="button" data-dtp-preset="tomorrow9">明天9:00</button><button type="button" data-dtp-preset="1y">1年后</button><button type="button" data-dtp-preset="y2030">2030.01.01</button></div></div>'
    }
    this.pickerTarget.innerHTML = html
    if (this.pickerOpen) window.setTimeout(() => this.updatePickerPlacement())
  }

  normalizePickerManual() {
    const values = {}
    this.pickerTarget.querySelectorAll("[data-part]").forEach((el) => { values[el.dataset.part] = String(el.value || "").replace(/\D/g, "") })
    const y = Math.min(9999, Math.max(1, Number(values.year) || this.pickerDraft.getFullYear()))
    const m = Math.min(12, Math.max(1, Number(values.month) || this.pickerDraft.getMonth() + 1))
    const d = Math.min(this.daysInMonth(y, m - 1), Math.max(1, Number(values.day) || this.pickerDraft.getDate()))
    const h = Math.min(23, Math.max(0, Number(values.hour) || 0))
    const min = Math.min(59, Math.max(0, Number(values.minute) || 0))
    this.commitPickerDraft(new Date(y, m - 1, d, h, min, 0, 0))
  }

  handlePickerClick(event) {
    const target = event.target
    if (target.closest(".cy-dtp__trigger")) { this.pickerOpen = !this.pickerOpen; if (this.pickerOpen) this.syncPickerFromInput(); else this.renderPicker(); return }
    if (target.closest("[data-dtp-cancel]")) { this.pickerOpen = false; this.syncPickerFromInput(); return }
    if (target.closest("[data-dtp-confirm]")) { this.openVisibleTarget.value = this.toLocalValue(this.pickerDraft); this.syncHidden(); this.pickerOpen = false; this.renderPicker(); return }
    const monthBtn = target.closest("[data-month]")
    if (monthBtn) { this.pickerViewMonth = new Date(this.pickerViewMonth.getFullYear(), this.pickerViewMonth.getMonth() + Number(monthBtn.dataset.month), 1); this.renderPicker(); return }
    const dayBtn = target.closest("[data-day]")
    if (dayBtn) { this.pickerDraft.setFullYear(this.pickerViewMonth.getFullYear(), this.pickerViewMonth.getMonth(), Number(dayBtn.dataset.day)); this.commitPickerDraft(new Date(this.pickerDraft)); return }
    const presetBtn = target.closest("[data-dtp-preset]")
    if (presetBtn) this.commitPickerDraft(this.pickerPresetDate(presetBtn.dataset.dtpPreset))
  }

  handlePickerChange(event) {
    const target = event.target
    if (target.matches("[data-time='hour']")) { this.pickerDraft.setHours(Number(target.value)); this.commitPickerDraft(new Date(this.pickerDraft)) }
    if (target.matches("[data-time='minute']")) { this.pickerDraft.setMinutes(Number(target.value)); this.commitPickerDraft(new Date(this.pickerDraft)) }
    if (target.matches("[data-part]")) this.normalizePickerManual()
  }

  handlePickerKeydown(event) {
    const part = event.target && event.target.dataset && event.target.dataset.part
    if (!part || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
    event.preventDefault()
    const delta = event.key === "ArrowUp" ? 1 : -1
    const next = new Date(this.pickerDraft)
    if (part === "year") next.setFullYear(Math.min(9999, Math.max(1, next.getFullYear() + delta)))
    else if (part === "month") next.setMonth(next.getMonth() + delta)
    else if (part === "day") next.setDate(next.getDate() + delta)
    else if (part === "hour") next.setHours(next.getHours() + delta)
    else next.setMinutes(next.getMinutes() + delta)
    this.commitPickerDraft(next)
  }

  // ---- AI ----
  updateAiBtn() {
    if (this.hasAiBtnTarget) this.aiBtnTarget.textContent = this.aiGenerated ? "✨ 重新生成" : "✨ AI 生成"
  }

  onTitleInput() {
    this.renderRecos()
    this.updateAiBtn()
  }

  escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  }

  renderRecos() {
    if (!this.hasRecoAreaTarget) return
    const show = this.hasTitleTarget && !this.titleTarget.value.trim() && this.recos.length > 0
    if (!show) { this.recoAreaTarget.innerHTML = ""; return }
    let html = '<div class="cy-field"><div style="display:flex;align-items:center;gap:var(--space-2)">'
      + '<label style="margin:0">✨ 没有头绪？试试这些灵感</label>'
      + '<button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-testid="reco-refresh"'
      + ' data-action="click->create#refreshReco" style="margin-left:auto">换一批</button>'
      + '</div><div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">'
    const palettes = ["brand", "accent", "signal"]
    this.recos.forEach((r, i) => {
      const p = palettes[i % palettes.length]
      html += '<button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-testid="reco-chip"'
        + ' data-action="click->create#pickReco" data-reco-title="' + this.escapeHtml(r.title) + '"'
        + ' title="' + this.escapeHtml(r.hint || "") + '"'
        + ' style="white-space:nowrap;border:1px solid var(--color-' + p + '-primary);border-radius:var(--radius-full)">'
        + this.escapeHtml(r.title) + "</button>"
    })
    html += "</div></div>"
    this.recoAreaTarget.innerHTML = html
  }

  loadRecos() {
    const seq = ++this.recoSeq
    fetch("/api/v1/capsule-recommendations?count=4", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((env) => {
        if (seq !== this.recoSeq) return
        const items = (env && env.data && env.data.items) || []
        if (items.length > 0) { this.recos = items; this.renderRecos() }
      })
      .catch(() => { /* 推荐失败静默：保留已有 */ })
  }

  refreshReco() {
    this.loadRecos()
  }

  pickReco(event) {
    const rt = event.currentTarget.dataset.recoTitle
    if (this.hasTitleTarget) this.titleTarget.value = rt
    if (this.hasContentTarget) this.contentTarget.value = ""
    this.aiGenerated = false
    this.renderRecos()
    this.runAiGenerate(rt)
  }

  aiGenerate() {
    this.runAiGenerate(this.hasTitleTarget ? this.titleTarget.value : "")
  }

  runAiGenerate(rawTitle) {
    const t = (rawTitle || "").trim()
    const autoTitle = !t
    if (this.hasAiBtnTarget) { this.aiBtnTarget.disabled = true; this.aiBtnTarget.textContent = "生成中…" }
    fetch("/api/v1/capsule-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(t ? { title: t } : {}),
    })
      .then((r) => r.json())
      .then((env) => {
        const s = env && env.data
        if (!s) return
        if (this.hasContentTarget) this.contentTarget.value = s.content || ""
        if (this.hasOpenVisibleTarget && s.openAt) {
          this.openVisibleTarget.value = this.isoToLocalInput(new Date(s.openAt))
          this.syncPickerFromInput()
          this.syncHidden()
        }
        if (s.title && autoTitle && this.hasTitleTarget && !this.titleTarget.value.trim()) {
          this.titleTarget.value = s.title
        }
        this.aiGenerated = true
        this.renderRecos()
      })
      .catch(() => { /* 静默 */ })
      .finally(() => { if (this.hasAiBtnTarget) this.aiBtnTarget.disabled = false; this.updateAiBtn() })
  }
}
