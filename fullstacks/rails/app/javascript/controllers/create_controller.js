import { Controller } from "@hotwired/stimulus"

// 创建页增强：快速预设时间、本地时间→ISO（隐藏字段始终同步）、AI 灵感推荐与生成。
// AI 端点走同源 /api/v1 JSON（cookie→Bearer 桥鉴权）；逻辑对齐 React CreatePage / spring-mvc app.js。
export default class extends Controller {
  static targets = ["title", "content", "openVisible", "openHidden", "aiBtn", "recoArea"]

  connect() {
    this.recos = []
    this.aiGenerated = false
    this.recoSeq = 0
    if (this.hasOpenVisibleTarget && !this.openVisibleTarget.value && !this.openHiddenTarget.value) {
      this.openVisibleTarget.value = this.presetTime("1h")
    }
    this.syncHidden()
    this.updateAiBtn()
    this.loadRecos()
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
    this.syncHidden()
  }

  onOpenChange() {
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
