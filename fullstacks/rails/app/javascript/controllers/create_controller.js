import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { clampOpen, maxOpen, minOpen, presetTime } from "lib/date";
import { discardDraft, readDraft, syncDraftOwner, writeDraft } from "lib/draft";
import { api, reducedMotion, sleep, toast } from "lib/ui";

const TITLE_LIMIT = 60;
const CONTENT_LIMIT = 5000;
const KEEP = (value, length) => [...value].slice(0, length).join("");

export default class extends Controller {
  static targets = ["editor", "form", "title", "titleCount", "content", "contentCount", "time", "preset",
    "publication", "fieldError", "recommendations", "chips", "aiButton", "aiNote", "submit", "receipt"];
  static values = { owner: String };

  connect() {
    const owner = this.ownerValue;
    syncDraftOwner(owner);
    const saved = readDraft(owner);
    this.recommendations = [];
    this.titleTarget.value = saved?.title ?? this.titleTarget.value;
    this.contentTarget.value = saved?.content ?? this.contentTarget.value;
    this.publicationTarget.checked = saved?.inPlaza ?? this.publicationTarget.checked;
    const time = saved?.time;
    const restorable = time >= minOpen() && time <= maxOpen();
    this.setTime(restorable ? time : presetTime("1y"), restorable ? saved.preset : "1y");
    this.updateCounts();
    this.loadRecommendations();
  }

  disconnect() {
    this.ai?.abort();
    this.recommendationRequest?.abort();
  }

  showTimeHook() {
    const skin = document.documentElement.dataset.skin;
    for (const control of this.element.querySelectorAll("[data-openat-control]")) {
      control.dataset.value = this.timeTarget.value;
      if (control.dataset.openatControl === skin) control.dataset.testid = "create-openat";
      else delete control.dataset.testid;
    }
  }

  snapshot() {
    return { title: this.titleTarget.value, content: this.contentTarget.value, time: Date.parse(this.timeTarget.value),
      inPlaza: this.publicationTarget.checked, preset: this.selectedPreset };
  }

  save() {
    const snapshot = this.snapshot();
    writeDraft(this.ownerValue, snapshot);
    return snapshot;
  }

  edit(event) {
    if (event.isComposing) return;
    const input = event.target;
    if (input === this.titleTarget || input === this.contentTarget) {
      this.cancelAI();
      const field = input === this.titleTarget ? "title" : "content";
      input.value = KEEP(input.value, field === "title" ? TITLE_LIMIT : CONTENT_LIMIT);
      this.setError(field);
    } else if (input !== this.publicationTarget) {
      return;
    }
    this.updateCounts();
    this.save();
  }

  choosePreset({ currentTarget }) {
    this.cancelAI();
    const key = currentTarget.dataset.value;
    this.setTime(presetTime(key), key);
    this.save();
  }

  pickTime({ detail }) {
    this.cancelAI();
    this.setTime(detail.time, null, detail.source);
    this.save();
  }

  setTime(time, preset, source) {
    const when = clampOpen(time);
    this.selectedPreset = preset;
    this.timeTarget.value = new Date(when).toISOString();
    this.setError("openAt");
    this.presetTargets.forEach((button) => {
      const active = button.dataset.value === preset;
      button.dataset.selected = active;
      button.setAttribute("aria-pressed", active);
      for (const name of ["is-active", "is-on"]) button.classList.toggle(name, active);
    });
    this.showTimeHook();
    this.dispatch("time-changed", { detail: { time: when, source } });
  }

  updateCounts() {
    const title = this.titleTarget.value;
    this.titleCountTarget.textContent = `${[...title].length} / ${TITLE_LIMIT}`;
    this.contentCountTarget.textContent = `${[...this.contentTarget.value].length} / ${CONTENT_LIMIT}`;
    const show = !title.trim() && this.recommendations.length > 0;
    this.recommendationsTarget.hidden = !show;
    if (show) this.recommendationsTarget.dataset.testid = "ai-reco";
    else delete this.recommendationsTarget.dataset.testid;
  }

  async loadRecommendations() {
    this.recommendationRequest?.abort();
    const request = new AbortController();
    this.recommendationRequest = request;
    const { signal } = request;
    try {
      const result = await api("/capsule-recommendations?count=4", { signal });
      signal.throwIfAborted();
      if (result.items.length) {
        this.recommendations = result.items;
        const buttons = result.items.map((item, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "btn btn--ghost btn--sm reco__chip";
          button.dataset.testid = "reco-chip";
          button.dataset.action = "create#useRecommendation";
          button.dataset.recommendation = index;
          button.title = item.hint;
          button.textContent = item.title;
          return button;
        });
        this.chipsTarget.replaceChildren(...buttons);
      }
      this.updateCounts();
    } catch {
      // 推荐不可用时仍可正常写信。
    }
  }

  useRecommendation({ currentTarget }) {
    const item = this.recommendations[Number(currentTarget.dataset.recommendation)];
    if (item) this.generateWithTitle(item.title);
  }

  generate() { this.generateWithTitle(); }

  cancelAI() {
    this.ai?.abort();
    this.ai = null;
    this.aiButtonTarget.disabled = false;
    this.aiNoteTarget.textContent = "";
  }

  async generateWithTitle(recommendedTitle) {
    if (this.ai || this.submitting) return;
    const calledWithTitle = KEEP((recommendedTitle ?? this.titleTarget.value).trim(), TITLE_LIMIT);
    if (recommendedTitle) {
      this.titleTarget.value = calledWithTitle;
      this.setError("title");
      this.updateCounts();
      this.save();
    }
    const request = new AbortController();
    const { signal } = request;
    this.ai = request;
    this.aiButtonTarget.disabled = true;
    this.aiNoteTarget.textContent = "正在代笔…";
    try {
      const result = await api("/capsule-suggestion", { method: "POST", data: { title: calledWithTitle || undefined }, signal });
      signal.throwIfAborted();
      if (!calledWithTitle && result.title) await this.type(this.titleTarget, KEEP(result.title, TITLE_LIMIT), 1, signal);
      const suggested = Date.parse(result.openAt);
      if (Number.isFinite(suggested)) this.setTime(Math.max(suggested, minOpen() + 30_000), null);
      await this.type(this.contentTarget, KEEP(result.content, CONTENT_LIMIT), 3, signal);
      this.setError("content");
      this.aiNoteTarget.textContent = `已为你代笔 · 建议 ${result.openInDays} 天后开启`;
    } catch (error) {
      if (!signal.aborted) {
        this.aiNoteTarget.textContent = "";
        toast(error.message || "AI 暂时没有回应，请稍后再试", "error");
      }
    } finally {
      if (this.ai === request) {
        this.ai = null;
        if (this.element.isConnected) this.aiButtonTarget.disabled = false;
      }
    }
  }

  async type(target, value, step, signal) {
    const letters = [...value];
    if (!reducedMotion()) {
      for (let count = step; count < letters.length; count += step) {
        signal.throwIfAborted();
        target.value = letters.slice(0, count).join("");
        this.updateCounts();
        this.save();
        await sleep(14, signal);
      }
    }
    signal.throwIfAborted();
    target.value = value;
    this.updateCounts();
    this.save();
  }

  setError(field, message = "") {
    const node = this.fieldErrorTargets.find((item) => item.dataset.field === field);
    node.hidden = !message;
    node.textContent = message;
    if (message) node.dataset.testid = "field-error";
    else delete node.dataset.testid;
    node.parentElement.classList.toggle("is-error", Boolean(message));
  }

  validate(snapshot) {
    const errors = {
      title: snapshot.title.trim() ? "" : "先给这枚胶囊起个标题",
      content: snapshot.content.trim() ? "" : "还没写内容呢，写点什么吧",
      openAt: snapshot.time < minOpen() ? "开启时间至少要在 1 分钟之后" :
        snapshot.time > maxOpen() ? "开启时间不能超过 10 年" : ""
    };
    Object.entries(errors).forEach(([field, message]) => this.setError(field, message));
    const first = Object.keys(errors).find((field) => errors[field]);
    if (first === "title") this.titleTarget.focus();
    else if (first === "content") this.contentTarget.focus();
    else if (first === "openAt") this.element.querySelector('[data-testid="create-openat"]').scrollIntoView({ block: "center" });
    return !first;
  }

  async submit(event) {
    event.preventDefault();
    if (this.submitting) return;
    this.cancelAI();
    const snapshot = this.save();
    if (!this.validate(snapshot)) return;

    this.submitting = true;
    this.submitTarget.disabled = true;
    this.formTarget.setAttribute("aria-busy", "true");
    const body = new FormData(this.formTarget);
    body.set("title", snapshot.title.trim());
    try {
      const response = await fetch(this.formTarget.action, { method: "POST", body, headers: { Accept: "text/vnd.turbo-stream.html" } });
      if (response.redirected) {
        if (this.element.isConnected) Turbo.visit(response.url);
        return;
      }
      if (!response.ok) {
        const error = await response.json();
        if (!this.element.isConnected) return;
        const field = error.details?.[0]?.field;
        if (["title", "content", "openAt"].includes(field)) this.setError(field, error.message);
        else toast(error.message || "封存失败，请稍后再试", "error");
        return;
      }
      const stream = await response.text();
      discardDraft(this.ownerValue, snapshot);
      if (!this.element.isConnected) return;
      this.editorTarget.hidden = true;
      Turbo.renderStreamMessage(stream);
    } catch {
      if (this.element.isConnected) toast("封存失败，请稍后再试", "error");
    } finally {
      this.submitting = false;
      if (this.element.isConnected) {
        this.formTarget.removeAttribute("aria-busy");
        this.submitTarget.disabled = false;
      }
    }
  }

  // Turbo Stream 插入回执后再移动焦点，避免焦点留在隐藏的封存按钮上。
  receiptTargetConnected(node) {
    this.receiptObserver = new MutationObserver(() => {
      const title = node.querySelector("#receipt-title");
      if (title) {
        title.focus({ preventScroll: true });
        node.scrollIntoView({ block: "start", behavior: reducedMotion() ? "instant" : "smooth" });
      }
    });
    this.receiptObserver.observe(node, { childList: true });
  }

  receiptTargetDisconnected() { this.receiptObserver?.disconnect(); }

  receiptAction(event) {
    if (!event.target.closest("[data-create-again]")) return;
    this.receiptTarget.replaceChildren();
    this.editorTarget.hidden = false;
    const saved = readDraft(this.ownerValue);
    this.titleTarget.value = saved?.title ?? "";
    this.contentTarget.value = saved?.content ?? "";
    this.publicationTarget.checked = saved?.inPlaza ?? true;
    this.setTime(saved?.time ?? presetTime("1y"), saved ? saved.preset : "1y");
    this.updateCounts();
    this.titleTarget.focus();
    this.loadRecommendations();
  }
}
