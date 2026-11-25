import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { DAY, clampOpen, localDateTime, maxOpen, minOpen, presetTime, span } from "lib/date";
import { discardDraft, readDraft, syncDraftOwner, writeDraft } from "lib/draft";
import { api, reducedMotion, sleep, toast } from "lib/ui";
import { syncSkinHooks } from "lib/skin_view";

const TITLE_LIMIT = 60;
const CONTENT_LIMIT = 5000;
const KEEP = (value, length) => [...value].slice(0, length).join("");

export default class extends Controller {
  static targets = ["editor", "form", "title", "titleCount", "content", "contentCount", "time", "preset",
    "publication", "fieldError", "recommendations", "chips", "aiButton", "aiNote", "submit", "submitLabel", "receipt", "view", "writing"];
  static values = { owner: String };

  connect() {
    const owner = this.ownerValue;
    syncDraftOwner(owner);
    const saved = readDraft(owner);
    this.recommendations = [];
    this.write("title", saved?.title ?? this.titleTarget.value);
    this.write("content", saved?.content ?? this.contentTarget.value);
    this.write("publication", saved?.inPlaza ?? this.publicationTarget.checked, "checked");
    this.switchSkin();
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

  get skin() { return document.documentElement.dataset.skin; }

  activeField(name) {
    return this.viewTargets.find((view) => view.dataset.skinOnly === this.skin)
      .querySelector(`[data-create-target~="${name}"]`);
  }

  write(name, value, property = "value") {
    this[`${name}Targets`].forEach((node) => {
      if (node[property] !== value) node[property] = value;
    });
  }

  switchSkin() {
    this.viewTargets.forEach((view) => { view.disabled = view.dataset.skinOnly !== this.skin; });
    syncSkinHooks(this.element);
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
    if (this.titleTargets.includes(input) || this.contentTargets.includes(input)) {
      this.cancelAI();
      const field = this.titleTargets.includes(input) ? "title" : "content";
      this.write(field, KEEP(input.value, field === "title" ? TITLE_LIMIT : CONTENT_LIMIT));
      this.setError(field);
    } else if (this.publicationTargets.includes(input)) {
      this.write("publication", input.checked, "checked");
    } else {
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
    this.element.querySelectorAll("[data-openat-control]").forEach((node) => {
      node.dataset.value = this.timeTarget.value;
      node.dataset.viewTestid = "create-openat";
    });
    this.updatePreview();
    syncSkinHooks(this.element);
    this.dispatch("time-changed", { detail: { time: when, source } });
  }

  updateCounts() {
    const title = this.titleTarget.value;
    this.write("titleCount", String([...title].length), "textContent");
    this.write("contentCount", String([...this.contentTarget.value].length), "textContent");
    const show = !title.trim() && this.recommendations.length > 0;
    this.recommendationsTargets.forEach((node) => {
      node.hidden = !show;
      node.classList.toggle("is-hidden", !show);
      node.dataset.viewTestid = "ai-reco";
    });
    this.updatePreview();
    syncSkinHooks(this.element);
  }

  updatePreview() {
    const { title, content, time, inPlaza } = this.snapshot();
    const name = title.trim();
    const date = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" });
    const values = {
      title: name || "未命名的胶囊",
      "paper-title": `《${name || "未命名的信"}》`,
      date: Number.isFinite(time) ? date.format(time) : "",
      "date-time": Number.isFinite(time) ? localDateTime.format(time) : "",
      duration: Number.isFinite(time) ? span(time - Date.now()) : "",
      length: String([...content].length),
      visibility: inPlaza ? "广场公开" : "仅凭码可见",
      "visibility-label": inPlaza ? "发布到胶囊广场" : "只凭胶囊码可见",
    };
    this.element.querySelectorAll("[data-preview]").forEach((node) => {
      const key = node.dataset.preview;
      if (key === "visibility-copy") {
        const paper = node.closest('[data-skin-only="paper"]');
        node.textContent = inPlaza ? (paper ? "所有人能看到标题与倒计时；正文在启封后公开。" : "标题与昵称公开展示，内容到时间才可见") :
          "不会出现在广场；把胶囊码交给谁，谁才能找到它。";
      } else {
        node.textContent = values[key];
      }
      if (node.classList.contains("badge") && key === "visibility") {
        node.classList.toggle("badge--plaza", inPlaza);
        node.classList.toggle("badge--private", !inPlaza);
      }
    });
    this.element.querySelector(".envf")?.classList.toggle("is-private", !inPlaza);
    this.element.querySelector(".toggle-card")?.classList.toggle("is-on", inPlaza);
    const postmark = this.element.querySelector(".envf__pm .pm__l1");
    if (postmark) postmark.textContent = values.date;
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
        this.chipsTargets.forEach((chips) => {
          const buttons = result.items.map((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "reco";
            button.dataset.viewTestid = "reco-chip";
            button.dataset.action = "create#useRecommendation";
            button.dataset.recommendation = index;
            button.style.setProperty("--i", index);
            for (const [tag, value] of [["b", item.title], ["span", item.hint], ["em", `${span(item.openInDays * DAY)}后`]]) {
              const part = document.createElement(tag);
              part.textContent = value;
              button.append(part);
            }
            return button;
          });
          chips.replaceChildren(...buttons);
        });
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
    this.setAiState(false);
    this.write("aiNote", "", "textContent");
  }

  setAiState(busy, thinking = false) {
    this.aiButtonTargets.forEach((button) => {
      button.disabled = busy;
      button.classList.toggle("is-busy", busy);
      button.querySelector("span").textContent = busy ? "代笔中…" : "AI 代笔";
    });
    this.writingTargets.forEach((sheet) => {
      sheet.classList.toggle("is-ai", busy);
      sheet.classList.toggle("is-thinking", thinking);
    });
  }

  async generateWithTitle(recommendedTitle) {
    if (this.ai || this.submitting) return;
    const calledWithTitle = KEEP((recommendedTitle ?? this.titleTarget.value).trim(), TITLE_LIMIT);
    if (recommendedTitle) {
      this.write("title", calledWithTitle);
      this.setError("title");
      this.updateCounts();
      this.save();
    }
    const request = new AbortController();
    const { signal } = request;
    this.ai = request;
    this.setAiState(true, true);
    this.write("aiNote", "正在代笔…", "textContent");
    try {
      const result = await api("/capsule-suggestion", { method: "POST", data: { title: calledWithTitle || undefined }, signal });
      signal.throwIfAborted();
      this.setAiState(true);
      if (!calledWithTitle && result.title) await this.type("title", KEEP(result.title, TITLE_LIMIT), 1, signal);
      const suggested = Date.parse(result.openAt);
      if (Number.isFinite(suggested)) {
        this.setTime(Math.max(suggested, minOpen() + 30_000), null);
        this.save();
      }
      await this.type("content", KEEP(result.content, CONTENT_LIMIT), 3, signal);
      this.setError("content");
      this.write("aiNote", `已为你代笔 · 建议 ${result.openInDays} 天后开启`, "textContent");
    } catch (error) {
      if (!signal.aborted) {
        this.write("aiNote", "", "textContent");
        toast(error.message || "AI 暂时没有回应，请稍后再试", "error");
      }
    } finally {
      if (this.ai === request) {
        this.ai = null;
        if (this.element.isConnected) this.setAiState(false);
      }
    }
  }

  async type(field, value, step, signal) {
    const letters = [...value];
    if (!reducedMotion()) {
      for (let count = step; count < letters.length; count += step) {
        signal.throwIfAborted();
        this.write(field, letters.slice(0, count).join(""));
        this.updateCounts();
        this.save();
        await sleep(14, signal);
      }
    }
    signal.throwIfAborted();
    this.write(field, value);
    this.updateCounts();
    this.save();
  }

  setError(field, message = "") {
    this.fieldErrorTargets.filter((node) => node.dataset.field === field).forEach((node) => {
      node.hidden = !message;
      node.textContent = message;
      node.dataset.viewTestid = "field-error";
      if (node.parentElement.matches(".field, .panel")) node.parentElement.classList.toggle("is-error", Boolean(message));
    });
    syncSkinHooks(this.element);
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
    if (first === "title") this.activeField("title").focus();
    else if (first === "content") this.activeField("content").focus();
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
    this.write("submit", true, "disabled");
    this.submitLabelTargets.forEach((label) => { label.textContent = "正在封存…"; });
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
        this.write("submit", false, "disabled");
        this.submitLabelTargets.forEach((label) => {
          label.textContent = label.closest('[data-skin-only="paper"]') ? "长按火漆，封缄" : "封存胶囊";
        });
      }
    }
  }

  receiptAction(event) {
    if (!event.target.closest("[data-create-again]")) return;
    this.receiptTarget.replaceChildren();
    this.editorTarget.hidden = false;
    const saved = readDraft(this.ownerValue);
    this.write("title", saved?.title ?? "");
    this.write("content", saved?.content ?? "");
    this.write("publication", saved?.inPlaza ?? true, "checked");
    this.setTime(saved?.time ?? presetTime("1y"), saved ? saved.preset : "1y");
    this.updateCounts();
    this.activeField("title").focus();
    this.loadRecommendations();
  }
}
