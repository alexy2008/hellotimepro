/* ============================================================
 * HelloTime Pro Laravel 全栈 · 创建页逻辑（2.0）
 * - createPage：外层共享状态（草稿按账号隔离、提交锁、AI 推荐与代笔、成功回执）
 * - paperRuler / paperCalendar / paperHoldSeal / paperCeremony：时笺专属部件
 * - amberDateTimePicker / amberSealed：琥珀「星轨时钟」与封存回执
 * ============================================================ */
(function () {
  "use strict";

  const MIN = 60000;
  const HOUR = 3600000;
  const DAY = 86400000;

  const LIMITS = {
    minOpen: () => Date.now() + 61 * 1000,
    maxOpen: () => HT.fmt.addCalendarYears(Date.now(), 10) - 5 * 60 * 1000,
  };

  const MSG = {
    title: "先给这枚胶囊起个标题",
    content: "还没写内容呢，写点什么吧",
    openMin: "开启时间至少要在 1 分钟之后",
    openMax: "开启时间不能超过 10 年",
  };

  function atNine(d) {
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }

  const PRESET_AT = {
    "1m": () => Date.now() + 125 * 1000,
    tm: () => { const d = new Date(); d.setDate(d.getDate() + 1); return atNine(d); },
    "1w": () => { const d = new Date(); d.setDate(d.getDate() + 7); return atNine(d); },
    "1mo": () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return atNine(d); },
    "1y": () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return atNine(d); },
    "5y": () => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return atNine(d); },
    "10y": () => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); d.setDate(d.getDate() - 1); return atNine(d); },
  };

  /* ---------------- 草稿按账号持久化（离开再回来保留；换号 / 登出自动清） ---------------- */
  function draftKey(userId) {
    return `hellotime.draft.${userId}`;
  }
  function loadDraftFor(userId) {
    const fresh = { title: "", content: "", openAt: PRESET_AT["1y"](), preset: "1y", inPlaza: true };
    if (!userId) return fresh;
    try {
      // 清理任何属于其他账号的残留草稿
      const mine = draftKey(userId);
      const stale = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("hellotime.draft.") && k !== mine) stale.push(k);
      }
      stale.forEach((k) => sessionStorage.removeItem(k));

      const raw = sessionStorage.getItem(mine);
      if (!raw) return fresh;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return fresh;
      const openAt = typeof d.openAt === "number" && d.openAt >= LIMITS.minOpen() ? d.openAt : PRESET_AT["1y"]();
      const preset = typeof d.openAt === "number" && d.openAt >= LIMITS.minOpen() ? (d.preset ?? null) : "1y";
      return {
        title: typeof d.title === "string" ? d.title : "",
        content: typeof d.content === "string" ? d.content : "",
        openAt,
        preset,
        inPlaza: typeof d.inPlaza === "boolean" ? d.inPlaza : true,
      };
    } catch {
      return fresh;
    }
  }
  function saveDraftFor(userId, d) {
    if (!userId) return;
    try {
      sessionStorage.setItem(draftKey(userId), JSON.stringify({
        title: d.title,
        content: d.content,
        openAt: d.openAt,
        preset: d.preset,
        inPlaza: d.inPlaza,
      }));
    } catch {}
  }

  /* ---------------- 时笺标尺常量 ---------------- */
  const ANCHORS = [
    { ms: 2 * MIN, label: "此刻" },
    { ms: HOUR, label: "1 小时" },
    { ms: DAY, label: "1 天" },
    { ms: 7 * DAY, label: "1 周" },
    { ms: 30 * DAY, label: "1 个月" },
    { ms: 182 * DAY, label: "半年" },
    { ms: 365 * DAY, label: "1 年" },
    { ms: 1096 * DAY, label: "3 年" },
    { ms: 1826 * DAY, label: "5 年" },
    { ms: 3651 * DAY, label: "10 年" },
  ];
  const SEGS = ANCHORS.length - 1;
  const SEG_W = 124;
  const STRIP_W = SEGS * SEG_W;

  function vToMs(v) {
    const x = HT.fmt.clamp(v, 0, 1) * SEGS;
    const i = Math.min(SEGS - 1, Math.floor(x));
    return ANCHORS[i].ms * Math.pow(ANCHORS[i + 1].ms / ANCHORS[i].ms, x - i);
  }
  function msToV(span) {
    const m = HT.fmt.clamp(span, ANCHORS[0].ms, ANCHORS[SEGS].ms);
    for (let i = 0; i < SEGS; i++) {
      if (m <= ANCHORS[i + 1].ms) {
        return (i + Math.log(m / ANCHORS[i].ms) / Math.log(ANCHORS[i + 1].ms / ANCHORS[i].ms)) / SEGS;
      }
    }
    return 1;
  }
  function roundOpen(span) {
    const d = new Date(Date.now() + span);
    if (span < HOUR) d.setSeconds(0, 0);
    else if (span < DAY) d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    else if (span < 30 * DAY) d.setMinutes(0, 0, 0);
    else d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  const rulerMin = () => LIMITS.minOpen() + 30 * 1000;
  const clampRuler = (t) => HT.fmt.clamp(t, rulerMin(), LIMITS.maxOpen());

  /* ---------------- 琥珀星轨时钟工具 ---------------- */
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  function moveTo(msVal, y, m) {
    const d = new Date(msVal);
    const day = d.getDate();
    d.setDate(1);
    d.setFullYear(y, m);
    d.setDate(Math.min(day, dim(y, m)));
    return d.getTime();
  }
  function addYears(msVal, n) {
    const d = new Date(msVal);
    return moveTo(msVal, d.getFullYear() + n, d.getMonth());
  }
  function addMonths(msVal, n) {
    const d = new Date(msVal);
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return moveTo(msVal, t.getFullYear(), t.getMonth());
  }
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function relText(t) {
    const msDiff = t - Date.now();
    if (msDiff < 3600000) return `${Math.max(1, Math.round(msDiff / MIN))} 分钟后`;
    if (msDiff < DAY) return `${Math.round(msDiff / 3600000)} 小时后`;
    if (msDiff < 45 * DAY) return `${Math.round(msDiff / DAY)} 天后`;
    if (msDiff < 330 * DAY) return `约 ${Math.round(msDiff / (30.44 * DAY))} 个月后`;
    return `约 ${Math.round(msDiff / (365.25 * DAY))} 年后`;
  }
  function etaParts(t) {
    t += 30000;
    let cur = Date.now();
    let y = 0, mo = 0;
    while (addYears(cur, 1) <= t) { cur = addYears(cur, 1); y++; }
    while (addMonths(cur, 1) <= t) { cur = addMonths(cur, 1); mo++; }
    let msLeft = Math.max(0, t - cur);
    const d = Math.floor(msLeft / DAY); msLeft -= d * DAY;
    const h = Math.floor(msLeft / 3600000); msLeft -= h * 3600000;
    const m = Math.floor(msLeft / MIN);
    const parts = [];
    if (y) parts.push({ n: y, u: "年" });
    if (mo) parts.push({ n: mo, u: "个月" });
    if (d) parts.push({ n: d, u: "天" });
    parts.push({ n: h, u: "小时" }, { n: m, u: "分" });
    return parts;
  }
  /** 角度累加不取模：59→0 向前走一格，绝不倒转一整圈 */
  const unwrap = (prev, next) => (prev == null ? next : prev + ((((next - prev) % 360) + 540) % 360) - 180);

  document.addEventListener("alpine:init", () => {
    /* ================ 1. 创建页共享外层逻辑 ================ */
    Alpine.data("createPage", () => {
      const user = Alpine.store("auth").user;
      const userId = user ? user.id : null;
      const d0 = loadDraftFor(userId);
      let recoSeq = 0;
      let typeToken = 0;
      let submitPending = false;

      return {
        title: d0.title,
        content: d0.content,
        openAt: d0.openAt,
        preset: d0.preset,
        inPlaza: d0.inPlaza,
        draftVersion: 0,

        errors: { title: "", content: "", openAt: "" },
        shake: { title: 0, content: 0, openAt: 0 },
        submitting: false,
        created: null,

        recos: [],
        recoBusy: false,
        aiBusy: false,
        aiThinking: false,
        aiDone: false,
        aiNote: "",

        get showRecos() {
          return !this.title.trim() && this.recos.length > 0;
        },
        get titleLen() {
          return HT.fmt.charLen(this.title);
        },
        get contentLen() {
          return HT.fmt.charLen(this.content);
        },
        get span() {
          return this.openAt - Alpine.store("clock").now;
        },

        init() {
          if (this.openAt < LIMITS.minOpen()) {
            this.openAt = PRESET_AT["1y"]();
            this.preset = "1y";
          }
          this.loadRecos();
        },
        destroy() {
          typeToken += 1;
        },
        persistDraft() {
          this.draftVersion += 1;
          saveDraftFor(userId, this);
        },
        resetDraft() {
          this.title = "";
          this.content = "";
          this.openAt = PRESET_AT["1y"]();
          this.preset = "1y";
          this.inPlaza = true;
          this.draftVersion += 1;
          HT.clearAllDrafts();
        },
        stopTyping() {
          typeToken += 1;
          this.aiBusy = false;
          this.aiThinking = false;
        },
        setTitle(v, el) {
          if (this.aiBusy) this.stopTyping();
          const clipped = Array.from(String(v || "")).slice(0, 60).join("");
          if (el && el.value !== clipped) el.value = clipped;
          this.errors.title = "";
          this.title = clipped;
          this.persistDraft();
        },
        setContent(v, el) {
          if (this.aiBusy) this.stopTyping();
          const clipped = Array.from(String(v || "")).slice(0, 5000).join("");
          if (el && el.value !== clipped) el.value = clipped;
          this.errors.content = "";
          this.content = clipped;
          this.persistDraft();
        },
        setOpenAt(t, preset = null) {
          if (this.aiBusy) this.stopTyping();
          this.errors.openAt = "";
          this.openAt = t;
          this.preset = preset;
          this.persistDraft();
        },
        pickPreset(key) {
          const fn = PRESET_AT[key];
          if (fn) this.setOpenAt(fn(), key);
        },
        setInPlaza(v) {
          this.inPlaza = !!v;
          this.persistDraft();
        },
        clearErr(f) {
          if (f) this.errors[f] = "";
          else this.errors = { title: "", content: "", openAt: "" };
        },
        fail(f, msg) {
          this.errors[f] = msg;
          this.shake[f] += 1;
          this.$nextTick(() => {
            const sel = f === "title" ? '[data-testid="create-title"]' : f === "content" ? '[data-testid="create-content"]' : '[data-testid="create-openat"]';
            const el = document.querySelector(sel);
            if (el) {
              el.scrollIntoView({ behavior: HT.fmt.reducedMotion() ? "auto" : "smooth", block: "center" });
              if (f !== "openAt") el.focus({ preventScroll: true });
            }
          });
        },
        async loadRecos() {
          const my = ++recoSeq;
          this.recoBusy = true;
          try {
            const r = await HT.api.capsuleRecommendations(4);
            if (my !== recoSeq) return;
            if (r && Array.isArray(r.items) && r.items.length) {
              this.recos = r.items;
            }
          } catch {
            /* 静默 */
          } finally {
            if (my === recoSeq) this.recoBusy = false;
          }
        },
        async typeInto(which, text, token) {
          if (HT.fmt.reducedMotion()) {
            this[which] = text;
            this.persistDraft();
            return true;
          }
          const chars = Array.from(text);
          const step = which === "title" ? 1 : 3;
          for (let i = 0; i <= chars.length; i += step) {
            if (token !== typeToken) return false;
            this[which] = chars.slice(0, i).join("");
            await HT.fmt.sleep(/[，。？！、—…：\n]/.test(chars[i - 1] || "") ? 50 : 14);
          }
          if (token !== typeToken) return false;
          this[which] = text;
          this.persistDraft();
          return true;
        },
        async aiWrite(forcedTitle) {
          if (this.aiBusy) return;
          const token = ++typeToken;
          const typed = (forcedTitle !== undefined ? forcedTitle : this.title).trim();
          const auto = !typed;
          this.aiBusy = true;
          this.aiThinking = true;
          this.aiNote = "";
          this.clearErr();
          if (forcedTitle !== undefined) {
            this.title = forcedTitle;
            this.persistDraft();
          }
          // 请求成功之前不动已写正文；失败时原文保留；等待期间用户编辑会令 token 失效
          try {
            const s = await HT.api.suggestCapsule({ title: typed || undefined });
            if (token !== typeToken) return;
            this.aiThinking = false;
            const genTitle = s.title || typed;
            if (auto && !(await this.typeInto("title", genTitle, token))) return;
            this.content = "";
            const targetAt = Math.min(Math.max(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30000), LIMITS.maxOpen());
            this.openAt = targetAt;
            this.preset = null;
            this.persistDraft();
            if (!(await this.typeInto("content", s.content, token))) return;
            const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
            this.aiNote = `${auto ? "标题与正文均由 AI 代笔" : "已为你代笔"}，建议 ${HT.fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`;
            this.aiDone = true;
          } catch (e) {
            if (token === typeToken) {
              Alpine.store("feedback").toast(
                e instanceof HT.ApiError ? e.message : "AI 暂时没有回应，请稍后再试",
                { tone: "error" },
              );
            }
          } finally {
            if (token === typeToken) {
              this.aiBusy = false;
              this.aiThinking = false;
            }
          }
        },
        validate() {
          if (this.aiBusy) this.stopTyping();
          if (!this.title.trim()) { this.fail("title", MSG.title); return false; }
          if (!this.content.trim()) { this.fail("content", MSG.content); return false; }
          if (this.openAt < LIMITS.minOpen()) { this.fail("openAt", MSG.openMin); return false; }
          if (this.openAt > LIMITS.maxOpen()) { this.fail("openAt", MSG.openMax); return false; }
          return true;
        },
        async submit() {
          if (submitPending || !this.validate()) return null;
          submitPending = true;
          this.submitting = true;
          const ver = this.draftVersion;
          const payload = {
            title: this.title.trim(),
            content: this.content,
            openAt: new Date(this.openAt).toISOString(),
            inPlaza: this.inPlaza,
          };
          try {
            const c = await HT.api.createCapsule(payload);
            this.created = c;
            // 仅当草稿未被再次修改时清空本次提交的草稿版本
            if (this.draftVersion === ver) this.resetDraft();
            return c;
          } catch (e) {
            Alpine.store("feedback").toast(e instanceof HT.ApiError ? e.message : "封存失败，请稍后再试", { tone: "error" });
            return null;
          } finally {
            submitPending = false;
            this.submitting = false;
          }
        },
        again() {
          this.created = null;
          this.aiDone = false;
          this.aiNote = "";
          this.clearErr();
          window.scrollTo({ top: 0, behavior: HT.fmt.reducedMotion() ? "auto" : "smooth" });
          this.$nextTick(() => {
            const t = document.querySelector('[data-testid="create-title"]');
            if (t) t.focus({ preventScroll: true });
          });
        },
      };
    });

    /* ================ 2. 抖动辅助（跳过初值） ================ */
    Alpine.data("shakeOn", (expr) => ({
      shaking: false,
      prev: 0,
      init() {
        const read = () => {
          const parts = expr.split(".");
          let cur = this;
          for (const k of parts) cur = cur ? cur[k] : 0;
          return cur || 0;
        };
        this.prev = read();
        this.$watch(expr, (val) => {
          if (val === this.prev || !val) return;
          this.prev = val;
          this.shaking = true;
          setTimeout(() => { this.shaking = false; }, 480);
        });
      },
    }));

    /* ================ 3. 时笺：标尺 + 日历 + 长按火漆 + 封缄仪式 ================ */
    Alpine.data("paperRuler", () => ({
      drag: false,
      glide: false,
      dragV: null,
      lastTick: -1,
      calOpen: false,
      calYear: new Date().getFullYear(),
      calMonth: new Date().getMonth(),
      hourText: "09",
      minText: "00",
      selKey: "",
      freshRing: false,

      init() {
        const syncFromOpenAt = (t) => {
          const d = new Date(t);
          this.calYear = d.getFullYear();
          this.calMonth = d.getMonth();
          this.hourText = HT.fmt.pad2(d.getHours());
          this.minText = HT.fmt.pad2(d.getMinutes());
          const nextKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (this.selKey && this.selKey !== nextKey) {
            this.freshRing = true;
            setTimeout(() => { this.freshRing = false; }, 420);
          }
          this.selKey = nextKey;
        };
        syncFromOpenAt(this.openAt);
        this.$watch("openAt", syncFromOpenAt);
      },
      get v() {
        return this.dragV !== null ? this.dragV : msToV(this.openAt - Alpine.store("clock").now);
      },
      get stripTransform() {
        return `transform: translateX(${(-this.v * STRIP_W).toFixed(1)}px)`;
      },
      setFromV(nv) {
        const c = HT.fmt.clamp(nv, 0, 1);
        this.dragV = c;
        this.glide = false;
        this.setOpenAt(clampRuler(roundOpen(vToMs(c))), null);
      },
      tickFx(nv) {
        const idx = Math.round(nv * SEGS * 8);
        if (idx !== this.lastTick && this.$refs.needle && this.$refs.needle.animate && !HT.fmt.reducedMotion()) {
          this.$refs.needle.animate(
            [{ transform: "translateX(-50%) scaleY(1.14)" }, { transform: "translateX(-50%) scaleY(1)" }],
            { duration: 150, easing: "ease-out" },
          );
        }
        this.lastTick = idx;
      },
      onPointerDown(e) {
        if (e.button) return;
        const el = e.currentTarget;
        try { el.setPointerCapture(e.pointerId); } catch {}
        const x0 = e.clientX;
        const v0 = this.v;
        let moved = false;
        this.drag = true;
        const onMove = (ev) => {
          const dx = ev.clientX - x0;
          if (Math.abs(dx) > 3) moved = true;
          if (!moved) return;
          const nv = v0 - dx / STRIP_W;
          this.setFromV(nv);
          this.tickFx(nv);
        };
        const onUp = (ev) => {
          this.drag = false;
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
          if (!moved && ev.type === "pointerup") {
            const r = el.getBoundingClientRect();
            this.setFromV(v0 + (ev.clientX - (r.left + r.width / 2)) / STRIP_W);
          }
          this.dragV = null;
          this.glide = true;
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onUp);
      },
      onKeyDown(e) {
        const step = e.shiftKey ? 0.02 : 0.004;
        let nv = null;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") nv = this.v - step;
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") nv = this.v + step;
        else if (e.key === "PageDown") nv = (Math.ceil(this.v * SEGS - 0.001) - 1) / SEGS;
        else if (e.key === "PageUp") nv = (Math.floor(this.v * SEGS + 0.001) + 1) / SEGS;
        else if (e.key === "Home") nv = 0;
        else if (e.key === "End") nv = 1;
        if (nv === null) return;
        e.preventDefault();
        this.setFromV(nv);
        this.tickFx(nv);
        this.dragV = null;
      },
      pickPaperPreset(key) {
        this.dragV = null;
        this.glide = true;
        this.pickPreset(key);
      },
      calNav(deltaMonths) {
        const d = new Date(this.calYear, this.calMonth + deltaMonths, 1);
        this.calYear = d.getFullYear();
        this.calMonth = d.getMonth();
      },
      calCanPrevYear() {
        const lo = new Date(rulerMin()); lo.setHours(0, 0, 0, 0);
        return new Date(this.calYear - 1, this.calMonth + 1, 0) >= lo;
      },
      calCanPrevMonth() {
        const lo = new Date(rulerMin()); lo.setHours(0, 0, 0, 0);
        return new Date(this.calYear, this.calMonth, 0) >= lo;
      },
      calCanNextMonth() {
        const hi = new Date(LIMITS.maxOpen()); hi.setHours(23, 59, 59, 999);
        return new Date(this.calYear, this.calMonth + 1, 1) <= hi;
      },
      calCanNextYear() {
        const hi = new Date(LIMITS.maxOpen()); hi.setHours(23, 59, 59, 999);
        return new Date(this.calYear + 1, this.calMonth, 1) <= hi;
      },
      calCells() {
        const y = this.calYear, mo = this.calMonth;
        const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
        const today = new Date();
        const sel = new Date(this.openAt);
        const lo = new Date(rulerMin()); lo.setHours(0, 0, 0, 0);
        const hi = new Date(LIMITS.maxOpen()); hi.setHours(23, 59, 59, 999);
        const list = [];
        for (let i = 0; i < 42; i++) {
          const d = new Date(y, mo, 1 - lead + i);
          list.push({
            key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
            ts: d.getTime(),
            day: d.getDate(),
            out: d.getMonth() !== mo,
            today: sameDay(d, today),
            sel: sameDay(d, sel),
            dis: d < lo || d > hi,
            label: HT.fmt.cn(d.getTime()),
          });
        }
        return list;
      },
      calPickDay(ts) {
        const d = new Date(ts);
        const cur = new Date(this.openAt);
        d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
        this.dragV = null;
        this.glide = true;
        this.setOpenAt(clampRuler(d.getTime()), null);
      },
      commitTime(which, raw) {
        const cur = new Date(this.openAt);
        const n = HT.fmt.clamp(parseInt(raw, 10) || 0, 0, which === "h" ? 23 : 59);
        if (which === "h") cur.setHours(n);
        else cur.setMinutes(n);
        this.dragV = null;
        this.glide = true;
        this.setOpenAt(clampRuler(cur.getTime()), null);
        const next = new Date(this.openAt);
        this.hourText = HT.fmt.pad2(next.getHours());
        this.minText = HT.fmt.pad2(next.getMinutes());
      },
      timeKey(which, e) {
        if (e.key === "Enter") { this.commitTime(which, e.target.value); return; }
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const max = which === "h" ? 24 : 60;
        const step = (e.key === "ArrowUp" ? 1 : -1) * (which === "h" ? 1 : 5);
        this.commitTime(which, String(((parseInt(e.target.value, 10) || 0) + step + max) % max));
      },
      tzName() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
      },
    }));

    Alpine.data("paperHoldSeal", () => {
      const HOLD_MS = 1150;
      let holding = false;
      let rafId = 0;
      let timerId = 0;
      let t0 = 0;

      return {
        holdState: "", // '' | 'holding' | 'done'
        hint: "长按火漆，封缄",
        shaking: false,
        init() {
          this.$watch("created", (c) => {
            if (!c) {
              this.holdState = "";
              this.hint = "长按火漆，封缄";
              if (this.$refs.holdBtn) this.$refs.holdBtn.style.setProperty("--hp", "0");
            }
          });
        },
        destroy() {
          cancelAnimationFrame(rafId);
          clearTimeout(timerId);
          holding = false;
        },
        startHold() {
          if (holding || this.holdState === "done") return;
          if (!this.validate()) return;
          holding = true;
          t0 = performance.now();
          this.holdState = "holding";
          this.hint = "按住，别松手…";
          const frame = (t) => {
            if (!holding) return;
            if (this.$refs.holdBtn) {
              this.$refs.holdBtn.style.setProperty("--hp", HT.fmt.clamp((t - t0) / HOLD_MS, 0, 1).toFixed(3));
            }
            rafId = requestAnimationFrame(frame);
          };
          rafId = requestAnimationFrame(frame);
          // 完成由定时器驱动，后台标签页不会卡住（X2）
          timerId = window.setTimeout(() => this.completeHold(), HOLD_MS);
        },
        completeHold() {
          if (!holding) return;
          holding = false;
          cancelAnimationFrame(rafId);
          if (this.$refs.holdBtn) this.$refs.holdBtn.style.setProperty("--hp", "1");
          this.holdState = "done";
          this.submit().then((c) => {
            if (!c) {
              this.holdState = "";
              this.hint = "长按火漆，封缄";
              if (this.$refs.holdBtn) this.$refs.holdBtn.style.setProperty("--hp", "0");
            }
          });
        },
        cancelHold() {
          if (!holding) return;
          const quick = performance.now() - t0 < 320;
          holding = false;
          cancelAnimationFrame(rafId);
          clearTimeout(timerId);
          this.holdState = "";
          if (this.$refs.holdBtn) this.$refs.holdBtn.style.setProperty("--hp", "0");
          this.hint = quick ? "要按住约 1 秒才会封缄" : "长按火漆，封缄";
          if (quick) {
            this.shaking = true;
            setTimeout(() => { this.shaking = false; }, 480);
          }
        },
        onPointerDown(e) {
          if (e.button) return;
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          this.startHold();
        },
        onKeyDown(e) {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            this.startHold();
          }
        },
        onKeyUp(e) {
          if (e.key === " " || e.key === "Enter") this.cancelHold();
        },
      };
    });

    Alpine.data("paperCeremony", () => ({
      cerCls: "",
      envCls: " is-open is-rising",
      alive: true,
      async init() {
        const q = HT.fmt.reducedMotion();
        await HT.fmt.sleep(30);
        if (!this.alive) return;
        this.cerCls = " is-in";
        await HT.fmt.sleep(q ? 0 : 520);
        if (!this.alive) return;
        this.envCls = " is-open";
        await HT.fmt.sleep(q ? 0 : 760);
        if (!this.alive) return;
        this.envCls = "";
        await HT.fmt.sleep(q ? 0 : 780);
        if (!this.alive) return;
        this.cerCls = " is-in is-stamped";
        await HT.fmt.sleep(q ? 0 : 720);
        if (!this.alive) return;
        this.cerCls = " is-in is-stamped is-done";
        this.$nextTick(() => {
          if (this.$refs.firstCopy) this.$refs.firstCopy.focus({ preventScroll: true });
        });
      },
      destroy() {
        this.alive = false;
      },
    }));

    Alpine.data("amberSealed", () => ({
      shown: false,
      init() {
        window.scrollTo({ top: 0, behavior: HT.fmt.reducedMotion() ? "auto" : "smooth" });
        requestAnimationFrame(() => requestAnimationFrame(() => { this.shown = true; }));
      },
    }));

    /* ================ 4. 琥珀：星轨时钟（完全对齐 2.0 原型 datetime.js） ================ */
    Alpine.data("amberDateTimePicker", () => {
      let emitted = null;
      let curVal = Date.now();
      let railDrag = false;
      let dialDrag = false;
      let angH = null;
      let angM = null;
      let outsideHandler = null;
      let escapeHandler = null;
      let settleStop = null;

      return {
        open: false,
        mode: "h", // 'h' | 'm'
        viewYear: new Date().getFullYear(),
        viewMonth: new Date().getMonth(),
        clamped: false,
        draggingRail: false,
        draggingDial: false,
        rotH: 0,
        rotM: 0,

        init() {
          const syncExternal = (val) => {
            curVal = val;
            this.syncHands(val);
            if (emitted === val) {
              emitted = null;
              return;
            }
            emitted = null;
            const d = new Date(val);
            this.viewYear = d.getFullYear();
            this.viewMonth = d.getMonth();
            this.clamped = false;
          };
          syncExternal(this.openAt);
          this.$watch("openAt", syncExternal);
        },
        destroy() {
          this.teardownOpenListeners();
        },
        syncHands(val) {
          const d = new Date(val);
          const h = d.getHours();
          const m = d.getMinutes();
          angH = unwrap(angH, ((h % 12) + m / 60) * 30);
          angM = unwrap(angM, m * 6);
          this.rotH = angH;
          this.rotM = angM;
        },
        teardownOpenListeners() {
          if (outsideHandler) {
            document.removeEventListener("pointerdown", outsideHandler);
            outsideHandler = null;
          }
          if (escapeHandler) {
            document.removeEventListener("keydown", escapeHandler);
            escapeHandler = null;
          }
          if (settleStop) {
            settleStop();
            settleStop = null;
          }
        },
        reveal() {
          const trig = this.$refs.trigger;
          const inner = this.$refs.panelInner;
          if (!trig || !inner) return;
          const top = trig.getBoundingClientRect().top;
          const need = top + trig.offsetHeight + inner.offsetHeight;
          const bar = document.querySelector(".tabbar");
          const barH = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
          const headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
          const over = need - (window.innerHeight - barH - 16);
          const dy = Math.min(over, top - headH - 16);
          if (dy > 0) window.scrollBy({ top: dy, behavior: HT.fmt.reducedMotion() ? "auto" : "smooth" });
        },
        setOpen(o) {
          this.open = o;
          this.teardownOpenListeners();
          if (!o) {
            this.mode = "h";
            return;
          }
          requestAnimationFrame(() => this.reveal());

          // 展开动画结束后补滚一次（transitionend grid-template-rows + 500ms 兜底，仅执行一次）
          const panel = this.$refs.panel;
          if (panel) {
            let timer = 0;
            const onEnd = (e) => {
              if (e.target === panel && e.propertyName === "grid-template-rows") settle();
            };
            const stop = () => {
              window.clearTimeout(timer);
              panel.removeEventListener("transitionend", onEnd);
            };
            const settle = () => {
              stop();
              settleStop = null;
              if (this.open) this.reveal();
            };
            panel.addEventListener("transitionend", onEnd);
            timer = window.setTimeout(settle, 500);
            settleStop = stop;
          }

          outsideHandler = (e) => {
            const t = e.target;
            if (this.$el && t && !this.$el.contains(t) && !t.closest("[data-preset]")) {
              this.setOpen(false);
            }
          };
          escapeHandler = (e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              this.closeAndFocus();
            }
          };
          document.addEventListener("pointerdown", outsideHandler);
          document.addEventListener("keydown", escapeHandler);
        },
        closeAndFocus() {
          this.setOpen(false);
          if (this.$refs.trigger) this.$refs.trigger.focus({ preventScroll: true });
        },
        pick(t, keepView = false) {
          const c = HT.fmt.clamp(t, LIMITS.minOpen(), LIMITS.maxOpen());
          this.clamped = c !== t;
          emitted = c;
          curVal = c;
          if (!keepView) {
            const d = new Date(c);
            this.viewYear = d.getFullYear();
            this.viewMonth = d.getMonth();
          }
          this.syncHands(c);
          this.setOpenAt(c, null);
        },

        // ---- 触发条与星轨派生值 ----
        triggerDate() {
          const d = new Date(this.openAt);
          return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
        },
        triggerWd() {
          return WD[new Date(this.openAt).getDay()];
        },
        triggerTime() {
          const d = new Date(this.openAt);
          return `${HT.fmt.pad2(d.getHours())}:${HT.fmt.pad2(d.getMinutes())}`;
        },
        triggerRel() {
          return relText(this.openAt);
        },
        orbitF() {
          const now = Date.now();
          const maxOpen = LIMITS.maxOpen();
          return HT.fmt.clamp((this.openAt - now) / (maxOpen - now), 0, 1);
        },
        orbitNodes() {
          const Y = new Date().getFullYear();
          const selYear = new Date(this.openAt).getFullYear();
          const f = this.orbitF();
          return Array.from({ length: 11 }, (_, i) => ({
            i,
            year: Y + i,
            label: i ? String(Y + i) : "今年",
            past: i > 0 && i / 10 <= f + 1e-6,
            cur: Y + i === selYear,
          }));
        },
        jumpYear(offset) {
          const Y = new Date().getFullYear();
          this.pick(moveTo(curVal, Y + offset, new Date(curVal).getMonth()));
        },
        railTime(clientX) {
          const r = this.$refs.rail.getBoundingClientRect();
          const c = new Date(curVal);
          const d = new Date(Date.now() + HT.fmt.clamp((clientX - r.left) / r.width, 0, 1) * (LIMITS.maxOpen() - Date.now()));
          d.setHours(c.getHours(), c.getMinutes(), 0, 0);
          return d.getTime();
        },
        onRailDown(e) {
          if (e.target.closest(".orbit__node")) return;
          railDrag = true;
          this.draggingRail = true;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          this.pick(this.railTime(e.clientX));
        },
        onRailMove(e) {
          if (railDrag) this.pick(this.railTime(e.clientX));
        },
        endRail() {
          railDrag = false;
          this.draggingRail = false;
        },
        onCapKey(e) {
          const n = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
          const y = { PageUp: 1, PageDown: -1 }[e.key];
          if (!n && !y) return;
          e.preventDefault();
          this.pick(n ? addMonths(curVal, n) : addYears(curVal, y));
        },

        // ---- 日历 ----
        mcalTitle() {
          return `${this.viewYear} 年 ${this.viewMonth + 1} 月`;
        },
        mcalSub() {
          const yrs = this.viewYear - new Date().getFullYear();
          return yrs ? `${yrs} 年后` : "今年";
        },
        canPrevMonth() {
          const lo = new Date(LIMITS.minOpen()); lo.setHours(0, 0, 0, 0);
          return new Date(this.viewYear, this.viewMonth, 0) >= lo;
        },
        canNextMonth() {
          const hi = new Date(LIMITS.maxOpen()); hi.setHours(23, 59, 59, 999);
          return new Date(this.viewYear, this.viewMonth + 1, 1) <= hi;
        },
        shiftMonth(delta) {
          const d = new Date(this.viewYear, this.viewMonth + delta, 1);
          this.viewYear = d.getFullYear();
          this.viewMonth = d.getMonth();
        },
        mcalCells() {
          const vy = this.viewYear, vm = this.viewMonth;
          const dSel = new Date(this.openAt);
          const today = new Date();
          const lo = new Date(LIMITS.minOpen()); lo.setHours(0, 0, 0, 0);
          const hi = new Date(LIMITS.maxOpen()); hi.setHours(23, 59, 59, 999);
          const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
          const s0 = new Date(dSel); s0.setHours(0, 0, 0, 0);
          const lead = (new Date(vy, vm, 1).getDay() + 6) % 7;
          const out = [];
          for (let i = 0; i < 42; i++) {
            const c = new Date(vy, vm, 1 - lead + i);
            const sel = sameDay(c, dSel);
            const cls = ["mcal__d"];
            if (c.getMonth() !== vm) cls.push("is-out");
            if (sameDay(c, today)) cls.push("is-today");
            if (c > t0 && c < s0) cls.push("is-span");
            if (sel) cls.push("is-sel");
            out.push({
              key: `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}`,
              y: c.getFullYear(),
              m: c.getMonth(),
              day: c.getDate(),
              sel,
              dis: c < lo || c > hi,
              cls: cls.join(" "),
              label: `${c.getFullYear()}年${c.getMonth() + 1}月${c.getDate()}日`,
            });
          }
          return out;
        },
        pickMcalDay(cell) {
          const c = new Date(curVal);
          this.pick(new Date(cell.y, cell.m, cell.day, c.getHours(), c.getMinutes()).getTime(), true);
        },
        onGridKey(e) {
          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
          if (!step) return;
          e.preventDefault();
          this.pick(curVal + step * DAY);
          this.$nextTick(() => {
            const sel = this.$refs.grid && this.$refs.grid.querySelector(".is-sel");
            if (sel) sel.focus();
          });
        },

        // ---- 机械表盘 ----
        hourVal() { return new Date(this.openAt).getHours(); },
        minVal() { return new Date(this.openAt).getMinutes(); },
        dayVal() { return new Date(this.openAt).getDate(); },
        isDay() { const h = this.hourVal(); return h >= 6 && h < 18; },
        setHM(h, m) {
          const d = new Date(curVal);
          d.setHours(h, m, 0, 0);
          this.pick(d.getTime());
        },
        setAmPm(ap) {
          const d = new Date(curVal);
          const h = d.getHours();
          if (ap === "am" && h >= 12) this.setHM(h - 12, d.getMinutes());
          if (ap === "pm" && h < 12) this.setHM(h + 12, d.getMinutes());
        },
        dialApply(e) {
          const r = this.$refs.dial.getBoundingClientRect();
          const a = ((Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI + 360) % 360;
          const d = new Date(curVal);
          const h = d.getHours();
          const m = d.getMinutes();
          if (this.mode === "h") {
            this.setHM((Math.round(a / 30) % 12) + (h >= 12 ? 12 : 0), m);
            return;
          }
          const nm = Math.round(a / 6) % 60;
          this.setHM(m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h, nm);
        },
        onDialDown(e) {
          dialDrag = true;
          this.draggingDial = true;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          this.dialApply(e);
        },
        onDialMove(e) {
          if (dialDrag) this.dialApply(e);
        },
        endDial() {
          if (!dialDrag) return;
          dialDrag = false;
          this.draggingDial = false;
          if (this.mode === "h") this.mode = "m";
        },
        onDialKey(e) {
          if (e.key === "Enter") {
            e.preventDefault();
            this.mode = this.mode === "h" ? "m" : "h";
            return;
          }
          const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
          if (!k) return;
          e.preventDefault();
          this.pick(curVal + k * (this.mode === "h" ? 60 : 1) * MIN);
        },
        etaParts() {
          return etaParts(this.openAt);
        },
        tzName() {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
        },
      };
    });
  });
})();
