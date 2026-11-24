/* ============================================================
 * HelloTime Pro · Spring MVC 创建页客户端增强（2.0）
 *
 * 双皮肤共用同一份状态机：
 *   - 按当前登录账号隔离的草稿（登出 / 换账号 / 封存成功即清空）
 *   - AI 灵感主题推荐（空返回或标题非空时自动隐藏并移除钩子）
 *   - AI 代笔打字机（手动编辑立即中断，请求失败保留原文）
 *   - 时笺：对数时间标尺 + 精确日历 + 长按火漆封缄（支持键盘空格 X2）
 *   - 琥珀：星轨时钟（十年星轨 + 旅程线月历 + 昼夜机械表盘 + 二次补滚）
 *   - 封存完成双皮肤回执（切换皮肤继续查看同一份回执）
 * ============================================================ */
(function () {
  "use strict";

  const createRoot = document.querySelector("[data-ht-create-root]");
  if (!createRoot || !window.HT) return;

  const {
    fmt,
    pad2,
    clamp,
    sleep,
    reducedMotion,
    escHtml,
    focusIfIdle,
    addCalendarYears,
    paletteOf,
    iconSvg,
    currentSkin,
    syncSkinDom,
    setHook,
    setSubtreeUnhooked,
    apiFetch,
    ApiError,
    toast,
  } = window.HT;

  const MIN = 60000;
  const HOUR = 3600000;
  const DAY = 86400000;
  const DRAFT_KEY = "hellotime.draft";
  const currentUserId = document.body.dataset.userId || "";

  const LIMITS = {
    minOpen: () => Date.now() + 61 * 1000,
    maxOpen: () => addCalendarYears(Date.now(), 10) - 5 * 60 * 1000,
  };

  const MSG = {
    title: "先给这枚胶囊起个标题",
    content: "还没写内容呢，写点什么吧",
    openMin: "开启时间至少要在 1 分钟之后",
    openMax: "开启时间不能超过 10 年",
  };

  const atNine = (d) => {
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  };

  const PRESET_AT = {
    "1m": () => Date.now() + 125 * 1000,
    tm: () => { const d = new Date(); d.setDate(d.getDate() + 1); return atNine(d); },
    "1w": () => { const d = new Date(); d.setDate(d.getDate() + 7); return atNine(d); },
    "1mo": () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return atNine(d); },
    "1y": () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return atNine(d); },
    "5y": () => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return atNine(d); },
    "10y": () => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); d.setDate(d.getDate() - 1); return atNine(d); },
  };

  function freshDraft() {
    return {
      ownerId: currentUserId,
      title: "",
      content: "",
      openAt: PRESET_AT["1y"](),
      preset: "1y",
      inPlaza: true,
    };
  }

  function loadDraft() {
    if (!currentUserId) return freshDraft();
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return freshDraft();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ownerId !== currentUserId) {
        sessionStorage.removeItem(DRAFT_KEY);
        return freshDraft();
      }
      const openAt = typeof parsed.openAt === "number" && parsed.openAt >= LIMITS.minOpen()
        ? Math.min(parsed.openAt, LIMITS.maxOpen())
        : PRESET_AT["1y"]();
      const preset = openAt === parsed.openAt ? (parsed.preset ?? null) : "1y";
      return {
        ownerId: currentUserId,
        title: String(parsed.title || ""),
        content: String(parsed.content || ""),
        openAt,
        preset,
        inPlaza: parsed.inPlaza !== false,
      };
    } catch {
      return freshDraft();
    }
  }

  let draft = loadDraft();
  let errors = { title: "", content: "", openAt: "" };
  let recos = [];
  let recoBusy = false;
  let aiBusy = false;
  let aiThinking = false;
  let aiDone = false;
  let aiNote = "";
  let recoSeq = 0;
  let typeToken = 0;
  let submitPending = false;
  let createdCapsule = null;

  function saveDraft() {
    if (!currentUserId || createdCapsule) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }

  function clampCodePoints(str, max) {
    const cps = Array.from(String(str || ""));
    return cps.length <= max ? String(str || "") : cps.slice(0, max).join("");
  }

  /* ============================================================
   * 1. 时笺对数标尺与精确日历
   * ============================================================ */
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
    const x = clamp(v, 0, 1) * SEGS;
    const i = Math.min(SEGS - 1, Math.floor(x));
    return ANCHORS[i].ms * Math.pow(ANCHORS[i + 1].ms / ANCHORS[i].ms, x - i);
  }
  function msToV(span) {
    const m = clamp(span, ANCHORS[0].ms, ANCHORS[SEGS].ms);
    for (let i = 0; i < SEGS; i++) {
      if (m <= ANCHORS[i + 1].ms) {
        return (i + Math.log(m / ANCHORS[i].ms) / Math.log(ANCHORS[i + 1].ms / ANCHORS[i].ms)) / SEGS;
      }
    }
    return 1;
  }
  function roundRulerOpen(span) {
    const d = new Date(Date.now() + span);
    if (span < HOUR) d.setSeconds(0, 0);
    else if (span < DAY) d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    else if (span < 30 * DAY) d.setMinutes(0, 0, 0);
    else d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  let paperDragV = null;
  let paperCalOpen = false;
  let paperCalMonth = new Date(new Date(draft.openAt).getFullYear(), new Date(draft.openAt).getMonth(), 1);
  let paperLastSelKey = "";

  const rulerEl = createRoot.querySelector("[data-ht-paper-ruler]");
  const rulerStrip = createRoot.querySelector("[data-ht-ruler-strip]");
  const rulerNeedle = createRoot.querySelector("[data-ht-ruler-needle]");

  if (rulerStrip) {
    const ticks = [];
    for (let i = 0; i <= SEGS; i++) {
      ticks.push(`<i class="rt rt--major" style="left:${i * SEG_W}px"><b>${ANCHORS[i].label}</b></i>`);
      if (i < SEGS) {
        for (let k = 1; k < 8; k++) {
          ticks.push(`<i class="${k === 4 ? "rt rt--mid" : "rt"}" style="left:${i * SEG_W + (k * SEG_W) / 8}px"></i>`);
        }
      }
    }
    rulerStrip.innerHTML = ticks.join("");
  }

  let lastTickIdx = -1;
  function pulseNeedle(nv) {
    const idx = Math.round(nv * SEGS * 8);
    if (idx !== lastTickIdx && rulerNeedle?.animate && !reducedMotion()) {
      rulerNeedle.animate(
        [{ transform: "translateX(-50%) scaleY(1.14)" }, { transform: "translateX(-50%) scaleY(1)" }],
        { duration: 150, easing: "ease-out" }
      );
    }
    lastTickIdx = idx;
  }

  if (rulerEl) {
    rulerEl.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      try { rulerEl.setPointerCapture(e.pointerId); } catch {}
      const x0 = e.clientX;
      const v0 = paperDragV ?? msToV(draft.openAt - Date.now());
      let moved = false;
      rulerEl.classList.add("is-drag");
      rulerEl.classList.remove("is-glide");

      const onMove = (ev) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) > 3) moved = true;
        if (!moved) return;
        const nv = clamp(v0 - dx / STRIP_W, 0, 1);
        paperDragV = nv;
        pulseNeedle(nv);
        setOpenAt(clamp(roundRulerOpen(vToMs(nv)), LIMITS.minOpen() + 30000, LIMITS.maxOpen()), null, "ruler");
      };
      const onUp = (ev) => {
        rulerEl.classList.remove("is-drag");
        rulerEl.removeEventListener("pointermove", onMove);
        rulerEl.removeEventListener("pointerup", onUp);
        rulerEl.removeEventListener("pointercancel", onUp);
        if (!moved && ev.type === "pointerup") {
          const r = rulerEl.getBoundingClientRect();
          const nv = clamp(v0 + (ev.clientX - (r.left + r.width / 2)) / STRIP_W, 0, 1);
          setOpenAt(clamp(roundRulerOpen(vToMs(nv)), LIMITS.minOpen() + 30000, LIMITS.maxOpen()), null, "ruler");
        }
        paperDragV = null;
        rulerEl.classList.add("is-glide");
        syncAllViews();
      };
      rulerEl.addEventListener("pointermove", onMove);
      rulerEl.addEventListener("pointerup", onUp);
      rulerEl.addEventListener("pointercancel", onUp);
    });

    rulerEl.addEventListener("keydown", (e) => {
      const curV = msToV(draft.openAt - Date.now());
      const step = e.shiftKey ? 0.02 : 0.004;
      let nv = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") nv = curV - step;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") nv = curV + step;
      else if (e.key === "PageDown") nv = (Math.ceil(curV * SEGS - 0.001) - 1) / SEGS;
      else if (e.key === "PageUp") nv = (Math.floor(curV * SEGS + 0.001) + 1) / SEGS;
      else if (e.key === "Home") nv = 0;
      else if (e.key === "End") nv = 1;
      if (nv == null) return;
      e.preventDefault();
      const clampedV = clamp(nv, 0, 1);
      pulseNeedle(clampedV);
      paperDragV = null;
      setOpenAt(clamp(roundRulerOpen(vToMs(clampedV)), LIMITS.minOpen() + 30000, LIMITS.maxOpen()), null, "ruler");
    });
  }

  // 时笺精确日历
  const paperCalBtn = createRoot.querySelector("[data-ht-paper-cal-btn]");
  const paperCalWrap = createRoot.querySelector("[data-ht-paper-calwrap]");
  const paperCalBox = createRoot.querySelector("[data-ht-paper-cal]");

  function renderPaperCalendar() {
    if (!paperCalBox || !paperCalOpen) return;
    const sel = new Date(draft.openAt);
    const selKey = `${sel.getFullYear()}-${sel.getMonth()}-${sel.getDate()}`;
    const freshRing = paperLastSelKey !== selKey;
    paperLastSelKey = selKey;

    const y = paperCalMonth.getFullYear();
    const mo = paperCalMonth.getMonth();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const today = new Date();
    const lo = new Date(LIMITS.minOpen() + 30000); lo.setHours(0, 0, 0, 0);
    const hi = new Date(LIMITS.maxOpen()); hi.setHours(23, 59, 59, 999);

    const titleEl = paperCalBox.querySelector("[data-cal-title]");
    if (titleEl) titleEl.innerHTML = `<b class="latin">${y}</b> 年 <b class="latin">${mo + 1}</b> 月`;

    const navBtns = paperCalBox.querySelectorAll("[data-cal-nav]");
    navBtns.forEach((b) => {
      const n = parseInt(b.dataset.calNav, 10);
      if (n === -12) b.disabled = new Date(y - 1, mo + 1, 0) < lo;
      else if (n === -1) b.disabled = new Date(y, mo, 0) < lo;
      else if (n === 1) b.disabled = new Date(y, mo + 1, 1) > hi;
      else if (n === 12) b.disabled = new Date(y + 1, mo, 1) > hi;
    });

    const grid = paperCalBox.querySelector("[data-cal-grid]");
    if (grid) {
      grid.innerHTML = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(y, mo, 1 - lead + i);
        const out = d.getMonth() !== mo;
        const dis = d < lo || d > hi;
        const isSel = sameDay(d, sel);
        const cls = `cal__d${out ? " is-out" : ""}${sameDay(d, today) ? " is-today" : ""}${isSel ? " is-sel" : ""}`;
        const ring = isSel
          ? `<svg class="cal__ring${freshRing ? " is-draw" : ""}" viewBox="0 0 40 40" aria-hidden="true"><path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6"/></svg>`
          : "";
        return `<button type="button" class="${cls}" ${dis ? "disabled" : ""} data-cal-day="${d.getTime()}" aria-label="${fmt.cn(d.getTime())}" ${isSel ? 'aria-current="date"' : ""}>${d.getDate()}${ring}</button>`;
      }).join("");
    }

    const hInp = paperCalBox.querySelector("[data-cal-h]");
    const mInp = paperCalBox.querySelector("[data-cal-m]");
    if (hInp && document.activeElement !== hInp) hInp.value = pad2(sel.getHours());
    if (mInp && document.activeElement !== mInp) mInp.value = pad2(sel.getMinutes());
    const tzEl = paperCalBox.querySelector("[data-cal-tz]");
    if (tzEl) tzEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
  }

  paperCalBtn?.addEventListener("click", () => {
    paperCalOpen = !paperCalOpen;
    paperCalBtn.classList.toggle("is-open", paperCalOpen);
    paperCalBtn.setAttribute("aria-expanded", String(paperCalOpen));
    paperCalWrap?.classList.toggle("is-open", paperCalOpen);
    if (paperCalOpen) {
      const d = new Date(draft.openAt);
      paperCalMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      renderPaperCalendar();
    }
  });

  if (paperCalBox) {
    paperCalBox.addEventListener("click", (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const nav = t.closest("[data-cal-nav]");
      if (nav && !nav.disabled) {
        const step = parseInt(nav.dataset.calNav, 10);
        paperCalMonth = new Date(paperCalMonth.getFullYear(), paperCalMonth.getMonth() + step, 1);
        renderPaperCalendar();
        return;
      }
      const dayBtn = t.closest("[data-cal-day]");
      if (dayBtn && !dayBtn.disabled) {
        const picked = new Date(parseInt(dayBtn.dataset.calDay, 10));
        const cur = new Date(draft.openAt);
        picked.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
        paperDragV = null;
        rulerEl?.classList.add("is-glide");
        setOpenAt(clamp(picked.getTime(), LIMITS.minOpen() + 30000, LIMITS.maxOpen()), null, "cal");
      }
    });

    const commitCalTime = (which, raw) => {
      const cur = new Date(draft.openAt);
      const n = clamp(parseInt(raw, 10) || 0, 0, which === "h" ? 23 : 59);
      if (which === "h") cur.setHours(n);
      else cur.setMinutes(n);
      paperDragV = null;
      rulerEl?.classList.add("is-glide");
      setOpenAt(clamp(cur.getTime(), LIMITS.minOpen() + 30000, LIMITS.maxOpen()), null, "cal");
    };

    ["h", "m"].forEach((which) => {
      const inp = paperCalBox.querySelector(`[data-cal-${which}]`);
      if (!inp) return;
      inp.addEventListener("blur", () => commitCalTime(which, inp.value));
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitCalTime(which, inp.value);
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const max = which === "h" ? 24 : 60;
          const step = (e.key === "ArrowUp" ? 1 : -1) * (which === "h" ? 1 : 5);
          commitCalTime(which, String(((parseInt(inp.value, 10) || 0) + step + max) % max));
        }
      });
    });
  }

  /* ============================================================
   * 2. 琥珀「星轨时钟」DateTimePicker（升级指南 §2.8）
   * ============================================================ */
  const dtpRoot = createRoot.querySelector("[data-ht-amber-dtp]");
  const WD_SHORT = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const moveTo = (msVal, y, m) => {
    const d = new Date(msVal);
    const day = d.getDate();
    d.setDate(1);
    d.setFullYear(y, m);
    d.setDate(Math.min(day, dim(y, m)));
    return d.getTime();
  };
  const addLocalYears = (msVal, n) => {
    const d = new Date(msVal);
    return moveTo(msVal, d.getFullYear() + n, d.getMonth());
  };
  const addLocalMonths = (msVal, n) => {
    const d = new Date(msVal);
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return moveTo(msVal, t.getFullYear(), t.getMonth());
  };
  const unwrapAngle = (prev, next) =>
    prev == null ? next : prev + ((((next - prev) % 360) + 540) % 360) - 180;

  function dtpRel(t) {
    const diff = t - Date.now();
    if (diff < 3600000) return `${Math.max(1, Math.round(diff / MIN))} 分钟后`;
    if (diff < DAY) return `${Math.round(diff / 3600000)} 小时后`;
    if (diff < 45 * DAY) return `${Math.round(diff / DAY)} 天后`;
    if (diff < 330 * DAY) return `约 ${Math.round(diff / (30.44 * DAY))} 个月后`;
    return `约 ${Math.round(diff / (365.25 * DAY))} 年后`;
  }

  function dtpEtaParts(t) {
    let target = t + 30000;
    let cur = Date.now();
    let y = 0;
    let mo = 0;
    while (addLocalYears(cur, 1) <= target) { cur = addLocalYears(cur, 1); y++; }
    while (addLocalMonths(cur, 1) <= target) { cur = addLocalMonths(cur, 1); mo++; }
    let rem = Math.max(0, target - cur);
    const d = Math.floor(rem / DAY); rem -= d * DAY;
    const h = Math.floor(rem / 3600000); rem -= h * 3600000;
    const m = Math.floor(rem / MIN);
    const parts = [];
    if (y) parts.push({ n: y, u: "年" });
    if (mo) parts.push({ n: mo, u: "个月" });
    if (d) parts.push({ n: d, u: "天" });
    parts.push({ n: h, u: "小时" }, { n: m, u: "分" });
    return parts;
  }

  let dtpOpen = false;
  let dtpMode = "h";
  let dtpViewMonth = new Date(new Date(draft.openAt).getFullYear(), new Date(draft.openAt).getMonth(), 1);
  let dtpClamped = false;
  let dtpAngH = null;
  let dtpAngM = null;
  let dtpCleanupSettle = null;
  let dtpCleanupOutside = null;

  if (dtpRoot) {
    // 一次性生成表盘固定刻度与数字
    const dialStatic = dtpRoot.querySelector("[data-dtp-dial-static]");
    if (dialStatic) {
      const f2 = (n) => n.toFixed(2);
      const parts = [];
      for (let i = 0; i < 60; i++) {
        const a = (i * 6 * Math.PI) / 180;
        const five = i % 5 === 0;
        const r1 = five ? 92 : 96;
        parts.push(`<line class="clock__tick${five ? " is-5" : ""}" x1="${f2(110 + r1 * Math.sin(a))}" y1="${f2(110 - r1 * Math.cos(a))}" x2="${f2(110 + 100 * Math.sin(a))}" y2="${f2(110 - 100 * Math.cos(a))}"/>`);
        const rot = `rotate(${i * 6} 110 110)`;
        if (i === 0) parts.push('<path class="clock__lume" d="M106 -9h8L110 -3Z"/>');
        else if (i % 10 === 0) parts.push(`<text class="clock__bz clock__bz-n" x="110" y="-5.5" transform="${rot}">${i}</text>`);
        else if (five) parts.push(`<rect class="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" transform="${rot}"/>`);
        else if (i < 15) parts.push(`<rect class="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" transform="${rot}"/>`);
        else parts.push(`<circle class="clock__bz" cx="110" cy="-5.5" r=".7" transform="${rot}"/>`);
      }
      for (let h = 1; h <= 12; h++) {
        if (h === 3) continue;
        const a = (h * 30 * Math.PI) / 180;
        parts.push(`<text class="clock__num${h % 3 === 0 ? " is-q" : ""}" x="${f2(110 + 78 * Math.sin(a))}" y="${f2(110 - 78 * Math.cos(a))}">${h}</text>`);
      }
      dialStatic.innerHTML = parts.join("");
    }

    const trigger = dtpRoot.querySelector("[data-dtp-trigger]");
    const panel = dtpRoot.querySelector("[data-dtp-panel]");
    const inner = dtpRoot.querySelector("[data-dtp-inner]");
    const rail = dtpRoot.querySelector("[data-dtp-rail]");
    const cap = dtpRoot.querySelector("[data-dtp-cap]");
    const mcalGrid = dtpRoot.querySelector("[data-dtp-mcal-grid]");
    const dial = dtpRoot.querySelector("[data-dtp-dial]");

    function revealDtp() {
      if (!trigger || !inner) return;
      const top = trigger.getBoundingClientRect().top;
      const need = top + trigger.offsetHeight + inner.offsetHeight;
      const bar = document.querySelector('[data-skin-view="amber"] .tabbar');
      const barH = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
      const headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
      const over = need - (window.innerHeight - barH - 16);
      const dy = Math.min(over, top - headH - 16);
      if (dy > 0) window.scrollBy({ top: dy, behavior: reducedMotion() ? "auto" : "smooth" });
    }

    function setDtpOpen(nextOpen, focusTrigger = false) {
      if (dtpOpen === nextOpen) return;
      dtpOpen = nextOpen;
      dtpRoot.classList.toggle("is-open", dtpOpen);
      trigger?.setAttribute("aria-expanded", String(dtpOpen));

      if (dtpCleanupSettle) { dtpCleanupSettle(); dtpCleanupSettle = null; }
      if (dtpCleanupOutside) { dtpCleanupOutside(); dtpCleanupOutside = null; }

      if (!dtpOpen) {
        dtpMode = "h";
        if (focusTrigger) trigger?.focus({ preventScroll: true });
        renderDtp();
        return;
      }

      renderDtp();
      requestAnimationFrame(revealDtp);

      if (panel) {
        let timer = 0;
        const stop = () => {
          window.clearTimeout(timer);
          panel.removeEventListener("transitionend", onEnd);
        };
        const settle = () => {
          stop();
          revealDtp();
        };
        const onEnd = (e) => {
          if (e.target === panel && e.propertyName === "grid-template-rows") settle();
        };
        panel.addEventListener("transitionend", onEnd);
        timer = window.setTimeout(settle, 500);
        dtpCleanupSettle = stop;
      }

      const onOutside = (e) => {
        const t = e.target instanceof Element ? e.target : null;
        if (t && !dtpRoot.contains(t) && !t.closest("[data-preset]")) {
          setDtpOpen(false, false);
        }
      };
      document.addEventListener("pointerdown", onOutside);
      dtpCleanupOutside = () => document.removeEventListener("pointerdown", onOutside);
    }

    function dtpPick(rawMs, keepView = false) {
      const clamped = clamp(rawMs, LIMITS.minOpen(), LIMITS.maxOpen());
      dtpClamped = clamped !== rawMs;
      if (!keepView) {
        const d = new Date(clamped);
        dtpViewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      setOpenAt(clamped, null, "dtp");
    }

    trigger?.addEventListener("click", () => setDtpOpen(!dtpOpen));
    dtpRoot.querySelector("[data-dtp-done]")?.addEventListener("click", () => setDtpOpen(false, true));
    dtpRoot.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dtpOpen) {
        e.stopPropagation();
        setDtpOpen(false, true);
      }
    });

    // 十年星轨拖拽与节点点击
    let railDragging = false;
    const railTimeAt = (clientX) => {
      const r = rail.getBoundingClientRect();
      const c = new Date(draft.openAt);
      const d = new Date(Date.now() + clamp((clientX - r.left) / r.width, 0, 1) * (LIMITS.maxOpen() - Date.now()));
      d.setHours(c.getHours(), c.getMinutes(), 0, 0);
      return d.getTime();
    };
    rail?.addEventListener("pointerdown", (e) => {
      const node = e.target instanceof Element ? e.target.closest("[data-orbit-offset]") : null;
      if (node) {
        const offsetY = parseInt(node.dataset.orbitOffset, 10);
        dtpPick(moveTo(draft.openAt, new Date().getFullYear() + offsetY, new Date(draft.openAt).getMonth()));
        return;
      }
      railDragging = true;
      rail.classList.add("is-drag");
      try { rail.setPointerCapture(e.pointerId); } catch {}
      dtpPick(railTimeAt(e.clientX));
    });
    rail?.addEventListener("pointermove", (e) => {
      if (railDragging) dtpPick(railTimeAt(e.clientX));
    });
    const stopRailDrag = () => {
      if (!railDragging) return;
      railDragging = false;
      rail?.classList.remove("is-drag");
    };
    rail?.addEventListener("pointerup", stopRailDrag);
    rail?.addEventListener("pointercancel", stopRailDrag);

    cap?.addEventListener("keydown", (e) => {
      const n = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      const y = { PageUp: 1, PageDown: -1 }[e.key];
      if (!n && !y) return;
      e.preventDefault();
      dtpPick(n ? addLocalMonths(draft.openAt, n) : addLocalYears(draft.openAt, y));
    });

    // 月历翻月、点选与键盘方向键
    dtpRoot.querySelector("[data-dtp-mcal-prev]")?.addEventListener("click", () => {
      dtpViewMonth = new Date(dtpViewMonth.getFullYear(), dtpViewMonth.getMonth() - 1, 1);
      renderDtp();
    });
    dtpRoot.querySelector("[data-dtp-mcal-next]")?.addEventListener("click", () => {
      dtpViewMonth = new Date(dtpViewMonth.getFullYear(), dtpViewMonth.getMonth() + 1, 1);
      renderDtp();
    });
    mcalGrid?.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-mcal-day]") : null;
      if (!btn || btn.disabled) return;
      const d = new Date(parseInt(btn.dataset.mcalDay, 10));
      const cur = new Date(draft.openAt);
      d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
      dtpPick(d.getTime(), true);
    });
    mcalGrid?.addEventListener("keydown", (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      dtpPick(draft.openAt + step * DAY);
      requestAnimationFrame(() => mcalGrid.querySelector(".is-sel")?.focus());
    });

    // 表盘模式切换与上下午
    dtpRoot.querySelectorAll("[data-dtp-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        dtpMode = btn.dataset.dtpMode === "m" ? "m" : "h";
        renderDtp();
      });
    });
    dtpRoot.querySelectorAll("[data-dtp-ampm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = new Date(draft.openAt);
        const h = d.getHours();
        const ap = btn.dataset.dtpAmpm;
        if (ap === "am" && h >= 12) { d.setHours(h - 12, d.getMinutes(), 0, 0); dtpPick(d.getTime(), true); }
        if (ap === "pm" && h < 12) { d.setHours(h + 12, d.getMinutes(), 0, 0); dtpPick(d.getTime(), true); }
      });
    });

    // 拖动机械表盘指针
    let dialDragging = false;
    function applyDialPointer(e) {
      const r = dial.getBoundingClientRect();
      const angle = ((Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI + 360) % 360;
      const d = new Date(draft.openAt);
      const h = d.getHours();
      const m = d.getMinutes();
      if (dtpMode === "h") {
        d.setHours((Math.round(angle / 30) % 12) + (h >= 12 ? 12 : 0), m, 0, 0);
        dtpPick(d.getTime(), true);
      } else {
        const nm = Math.round(angle / 6) % 60;
        const nh = m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h;
        d.setHours(nh, nm, 0, 0);
        dtpPick(d.getTime(), true);
      }
    }
    dial?.addEventListener("pointerdown", (e) => {
      dialDragging = true;
      dial.classList.add("is-drag");
      try { dial.setPointerCapture(e.pointerId); } catch {}
      applyDialPointer(e);
    });
    dial?.addEventListener("pointermove", (e) => {
      if (dialDragging) applyDialPointer(e);
    });
    const stopDialDrag = () => {
      if (!dialDragging) return;
      dialDragging = false;
      dial?.classList.remove("is-drag");
      if (dtpMode === "h") {
        dtpMode = "m";
        renderDtp();
      }
    };
    dial?.addEventListener("pointerup", stopDialDrag);
    dial?.addEventListener("pointercancel", stopDialDrag);
    dial?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        dtpMode = dtpMode === "h" ? "m" : "h";
        renderDtp();
        return;
      }
      const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
      if (!k) return;
      e.preventDefault();
      dtpPick(draft.openAt + k * (dtpMode === "h" ? 60 : 1) * MIN, true);
    });
  }

  function renderDtp() {
    if (!dtpRoot) return;
    const val = draft.openAt;
    const d = new Date(val);
    const h = d.getHours();
    const m = d.getMinutes();
    const now = Date.now();
    const maxOpen = LIMITS.maxOpen();
    const frac = clamp((val - now) / Math.max(1, maxOpen - now), 0, 1);

    const trig = dtpRoot.querySelector("[data-dtp-trigger]");
    if (trig) trig.dataset.value = d.toISOString();
    const dateEl = dtpRoot.querySelector("[data-dtp-date]");
    const wdEl = dtpRoot.querySelector("[data-dtp-wd]");
    const timeEl = dtpRoot.querySelector("[data-dtp-time]");
    const relEl = dtpRoot.querySelector("[data-dtp-rel]");
    if (dateEl) dateEl.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    if (wdEl) wdEl.textContent = WD_SHORT[d.getDay()];
    if (timeEl) timeEl.textContent = `${pad2(h)}:${pad2(m)}`;
    if (relEl) relEl.textContent = dtpRel(val);

    if (!dtpOpen) return;

    const orbitK = dtpRoot.querySelector("[data-dtp-orbit-k]");
    const trail = dtpRoot.querySelector("[data-dtp-trail]");
    const nodesBox = dtpRoot.querySelector("[data-dtp-nodes]");
    const cap = dtpRoot.querySelector("[data-dtp-cap]");
    const curY = new Date().getFullYear();

    if (orbitK) orbitK.textContent = `${(frac * 10).toFixed(1)} / 10 年`;
    if (trail) trail.style.width = `${(frac * 100).toFixed(2)}%`;
    if (cap) {
      cap.style.left = `${(frac * 100).toFixed(2)}%`;
      cap.setAttribute("aria-valuetext", `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`);
    }
    if (nodesBox) {
      nodesBox.innerHTML = Array.from({ length: 11 }, (_, i) => {
        const past = i > 0 && i / 10 <= frac + 1e-6;
        const isCur = curY + i === d.getFullYear();
        const cls = `orbit__node${past ? " is-past" : ""}${isCur ? " is-cur" : ""}`;
        return `<button class="${cls}" type="button" style="left:${i * 10}%" data-orbit-offset="${i}" aria-label="穿越到 ${curY + i} 年"><i></i><span>${i ? curY + i : "今年"}</span></button>`;
      }).join("");
    }

    // 月历
    const vy = dtpViewMonth.getFullYear();
    const vm = dtpViewMonth.getMonth();
    const yrs = vy - curY;
    const mcalTitle = dtpRoot.querySelector("[data-dtp-mcal-title]");
    if (mcalTitle) mcalTitle.innerHTML = `${vy} 年 ${vm + 1} 月<small>${yrs ? `${yrs} 年后` : "今年"}</small>`;

    const lo = new Date(LIMITS.minOpen()); lo.setHours(0, 0, 0, 0);
    const hi = new Date(maxOpen); hi.setHours(23, 59, 59, 999);
    const prevBtn = dtpRoot.querySelector("[data-dtp-mcal-prev]");
    const nextBtn = dtpRoot.querySelector("[data-dtp-mcal-next]");
    if (prevBtn) prevBtn.disabled = new Date(vy, vm, 0) < lo;
    if (nextBtn) nextBtn.disabled = new Date(vy, vm + 1, 1) > hi;

    const today = new Date();
    const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
    const s0 = new Date(d); s0.setHours(0, 0, 0, 0);
    const lead = (new Date(vy, vm, 1).getDay() + 6) % 7;
    const mcalGrid = dtpRoot.querySelector("[data-dtp-mcal-grid]");
    if (mcalGrid) {
      mcalGrid.innerHTML = Array.from({ length: 42 }, (_, i) => {
        const c = new Date(vy, vm, 1 - lead + i);
        const sel = sameDay(c, d);
        const dis = c < lo || c > hi;
        const cls = ["mcal__d"];
        if (c.getMonth() !== vm) cls.push("is-out");
        if (sameDay(c, today)) cls.push("is-today");
        if (c > t0 && c < s0) cls.push("is-span");
        if (sel) cls.push("is-sel");
        return `<button type="button" role="gridcell" class="${cls.join(" ")}" ${dis ? "disabled" : ""} tabindex="${sel ? 0 : -1}" aria-selected="${sel}" aria-label="${c.getFullYear()}年${c.getMonth() + 1}月${c.getDate()}日" data-mcal-day="${c.getTime()}">${c.getDate()}</button>`;
      }).join("");
    }

    // 表盘（角度累加不取模）
    dtpAngH = unwrapAngle(dtpAngH, ((h % 12) + m / 60) * 30);
    dtpAngM = unwrapAngle(dtpAngM, m * 6);
    const isDay = h >= 6 && h < 18;
    const clock = dtpRoot.querySelector("[data-dtp-clock]");
    if (clock) {
      clock.classList.toggle("is-day", isDay);
      clock.classList.toggle("is-night", !isDay);
      clock.dataset.mode = dtpMode;
    }
    const modeHBtn = dtpRoot.querySelector('[data-dtp-mode="h"]');
    const modeMBtn = dtpRoot.querySelector('[data-dtp-mode="m"]');
    if (modeHBtn) { modeHBtn.textContent = pad2(h); modeHBtn.classList.toggle("is-on", dtpMode === "h"); }
    if (modeMBtn) { modeMBtn.textContent = pad2(m); modeMBtn.classList.toggle("is-on", dtpMode === "m"); }
    dtpRoot.querySelector('[data-dtp-ampm="am"]')?.classList.toggle("is-on", h < 12);
    dtpRoot.querySelector('[data-dtp-ampm="pm"]')?.classList.toggle("is-on", h >= 12);

    const dialDate = dtpRoot.querySelector("[data-dtp-dial-date]");
    if (dialDate) dialDate.textContent = String(d.getDate());
    const handH = dtpRoot.querySelector("[data-dtp-hand-h]");
    const handM = dtpRoot.querySelector("[data-dtp-hand-m]");
    if (handH) handH.style.transform = `rotate(${dtpAngH}deg)`;
    if (handM) handM.style.transform = `rotate(${dtpAngM}deg)`;
    const dial = dtpRoot.querySelector("[data-dtp-dial]");
    dial?.setAttribute("aria-valuetext", `${h} 点 ${m} 分`);
    const hint = dtpRoot.querySelector("[data-dtp-clock-hint]");
    if (hint) hint.textContent = dtpMode === "h" ? "拖动时针，松手后自动切到分针" : "拖动分针，越过 12 点会自动进退一小时";

    // 底栏精确倒计时
    const etaEl = dtpRoot.querySelector("[data-dtp-eta]");
    if (etaEl) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
      const segs = dtpEtaParts(val).map((p) => `<b>${p.n}</b>${p.u}`).join(" ");
      const sub = dtpClamped
        ? `<small class="is-warn">已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${escHtml(tz)}</small>`
        : `<small>按你所在的时区 ${escHtml(tz)} 计时</small>`;
      etaEl.innerHTML = `胶囊将在 ${segs} 后开启${sub}`;
    }
  }

  /* ============================================================
   * 3. 双皮肤视图同步与字段校验
   * ============================================================ */
  function autoGrowTextareas() {
    createRoot.querySelectorAll("[data-ht-create-content]").forEach((ta) => {
      if (!ta.offsetParent) return;
      const minH = ta.classList.contains("paper__text") ? 36 * 8 : 34 * 9;
      ta.style.height = "auto";
      ta.style.height = `${Math.max(ta.scrollHeight, minH)}px`;
    });
  }

  function syncRecosUi() {
    const show = !draft.title.trim() && recos.length > 0;
    createRoot.querySelectorAll("[data-ht-recos]").forEach((box) => {
      box.classList.toggle("is-hidden", !show);
      setHook(box, show ? "ai-reco" : "");
      const refreshBtn = box.querySelector("[data-ht-reco-refresh]");
      const refreshLab = box.querySelector("[data-ht-reco-refresh-label]");
      if (refreshBtn) refreshBtn.disabled = recoBusy || aiBusy;
      if (refreshLab) refreshLab.textContent = recoBusy ? "换一批中…" : "换一批";

      const listEl = box.querySelector("[data-ht-recos-list]");
      if (!listEl) return;
      if (!show) {
        listEl.innerHTML = "";
        return;
      }
      const isAmber = listEl.dataset.htRecosList === "amber";
      listEl.innerHTML = recos.map((r, i) => {
        const spanText = `${fmt.span(r.openInDays * DAY)}后`;
        const emHtml = isAmber ? `<em>${iconSvg("clock")}${escHtml(spanText)}</em>` : `<em>${escHtml(spanText)}</em>`;
        return `<button class="reco" type="button" style="--i:${i}" data-testid="reco-chip" data-reco-title="${escHtml(r.title)}" ${aiBusy ? "disabled" : ""}><b>${escHtml(r.title)}</b><span>${escHtml(r.hint)}</span>${emHtml}</button>`;
      }).join("");
      const view = box.closest("[data-skin-view]");
      if (view) syncSkinDom(view);
    });
  }

  function syncAllViews() {
    const now = Date.now();
    const span = draft.openAt - now;
    const iso = new Date(draft.openAt).toISOString();
    const titleLen = Array.from(draft.title).length;
    const contentLen = Array.from(draft.content).length;

    createRoot.querySelectorAll("[data-ht-create-title]").forEach((inp) => {
      if (inp.value !== draft.title) inp.value = draft.title;
    });
    createRoot.querySelectorAll("[data-ht-create-content]").forEach((ta) => {
      if (ta.value !== draft.content) ta.value = draft.content;
    });
    autoGrowTextareas();

    createRoot.querySelectorAll("[data-ht-title-count]").forEach((b) => (b.textContent = String(titleLen)));
    createRoot.querySelectorAll("[data-ht-content-count]").forEach((b) => (b.textContent = fmt.num(contentLen)));

    // AI 状态
    createRoot.querySelectorAll("[data-ht-paper-sheet], [data-ht-amber-paper]").forEach((el) => {
      el.classList.toggle("is-ai", aiBusy);
      el.classList.toggle("is-thinking", aiThinking);
    });
    createRoot.querySelectorAll("[data-ht-ai-btn]").forEach((btn) => {
      btn.classList.toggle("is-busy", aiBusy);
      const sp = btn.querySelector("[data-ht-ai-label]");
      if (sp) sp.textContent = aiBusy ? "代笔中…" : aiDone ? "重新代笔" : "AI 代笔";
    });
    createRoot.querySelectorAll("[data-ht-ai-note]").forEach((el) => {
      el.innerHTML = aiNote ? `${iconSvg("sparkle")}${escHtml(aiNote)}` : "";
    });
    syncRecosUi();

    // 校验错误
    ["title", "content", "openAt"].forEach((f) => {
      const msg = errors[f] || "";
      createRoot.querySelectorAll(`[data-ht-create-err="${f}"]`).forEach((el) => {
        el.textContent = msg;
        setHook(el, msg ? "field-error" : "");
      });
    });

    // 预设高亮
    createRoot.querySelectorAll("[data-ht-preset]").forEach((btn) => {
      const on = draft.preset === btn.dataset.htPreset;
      btn.classList.toggle("is-active", on);
      btn.dataset.selected = String(on);
    });

    // 时笺标尺与信封预览
    const v = paperDragV ?? msToV(span);
    if (rulerEl && rulerStrip) {
      rulerStrip.style.transform = `translateX(${(-v * STRIP_W).toFixed(1)}px)`;
      rulerEl.setAttribute("aria-valuenow", String(Math.round(v * 100)));
      rulerEl.setAttribute("aria-valuetext", `${fmt.span(span)}后，${fmt.full(draft.openAt)}`);
    }
    const paperRel = createRoot.querySelector("[data-ht-paper-rel]");
    const paperOpenAt = createRoot.querySelector("[data-ht-paper-openat]");
    if (paperRel) paperRel.textContent = `${fmt.span(span)}后`;
    if (paperOpenAt) {
      paperOpenAt.textContent = fmt.full(draft.openAt);
      paperOpenAt.dataset.value = iso;
    }
    renderPaperCalendar();

    const envf = createRoot.querySelector("[data-ht-paper-envf]");
    if (envf) {
      envf.classList.toggle("is-private", !draft.inPlaza);
      const pmL1 = envf.querySelector("[data-ht-pm-l1]");
      const pmL2 = envf.querySelector("[data-ht-pm-l2]");
      if (pmL1) pmL1.textContent = fmt.date(draft.openAt);
      if (pmL2) pmL2.textContent = `${fmt.time(draft.openAt)} 启`;
      const envDate = envf.querySelector("[data-ht-envf-date]");
      const envRel = envf.querySelector("[data-ht-envf-rel]");
      const envTitle = envf.querySelector("[data-ht-envf-title]");
      const envVis = envf.querySelector("[data-ht-envf-vis]");
      if (envDate) envDate.textContent = fmt.cn(draft.openAt);
      if (envRel) envRel.textContent = `${fmt.span(span)}后的未来`;
      if (envTitle) envTitle.textContent = draft.title.trim() ? `《${draft.title.trim()}》` : "《未命名的信》";
      if (envVis) envVis.textContent = draft.inPlaza ? "广场公开" : "仅凭码可见";
    }

    // 公开开关
    createRoot.querySelectorAll("[data-ht-in-plaza]").forEach((chk) => {
      if (chk.checked !== draft.inPlaza) chk.checked = draft.inPlaza;
    });
    const paperVisTitle = createRoot.querySelector("[data-ht-paper-vis-title]");
    const paperVisDesc = createRoot.querySelector("[data-ht-paper-vis-desc]");
    if (paperVisTitle) paperVisTitle.textContent = draft.inPlaza ? "发布到胶囊广场" : "只凭胶囊码可见";
    if (paperVisDesc) {
      paperVisDesc.textContent = draft.inPlaza
        ? "所有人能看到标题与倒计时；正文在启封后公开。"
        : "不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。";
    }
    const amberVisCard = createRoot.querySelector("[data-ht-amber-vis-card]");
    const amberVisDesc = createRoot.querySelector("[data-ht-amber-vis-desc]");
    amberVisCard?.classList.toggle("is-on", draft.inPlaza);
    if (amberVisDesc) {
      amberVisDesc.textContent = draft.inPlaza
        ? "标题与昵称公开展示，内容到时间才可见"
        : "不出现在广场；把胶囊码交给谁，谁才能找到它";
    }

    // 琥珀星轨时钟与右侧实时预览
    renderDtp();
    const amberSum = createRoot.querySelector("[data-ht-amber-sum]");
    if (amberSum) {
      amberSum.innerHTML = span > 0
        ? `将沉睡 <b>${escHtml(fmt.span(span))}</b>，于 ${escHtml(fmt.full(draft.openAt))} 开启`
        : "选一个开启的时刻";
    }
    const prevTitle = createRoot.querySelector("[data-ht-prev-title]");
    const prevOpenAt = createRoot.querySelector("[data-ht-prev-openat]");
    const prevSpan = createRoot.querySelector("[data-ht-prev-span]");
    const prevLen = createRoot.querySelector("[data-ht-prev-len]");
    const prevVis = createRoot.querySelector("[data-ht-prev-vis]");
    const prevBadgeSpan = createRoot.querySelector("[data-ht-prev-badge-span]");
    if (prevTitle) prevTitle.textContent = draft.title.trim() || "未命名的胶囊";
    if (prevOpenAt) prevOpenAt.textContent = fmt.dashDateTime(draft.openAt);
    if (prevSpan) prevSpan.textContent = span > 0 ? fmt.span(span) : "—";
    if (prevLen) prevLen.textContent = `${fmt.num(contentLen)} 字`;
    if (prevVis) {
      prevVis.className = `badge badge--${draft.inPlaza ? "plaza" : "private"}`;
      prevVis.innerHTML = draft.inPlaza ? `${iconSvg("globe")}广场公开` : `${iconSvg("lock")}仅凭码可见`;
    }
    if (prevBadgeSpan) prevBadgeSpan.textContent = `${fmt.span(Math.max(0, span))}后`;
  }

  function triggerShakeField(field) {
    createRoot.querySelectorAll(`[data-ht-shake="${field}"]`).forEach((el) => {
      el.classList.remove("is-shake");
      void el.offsetWidth;
      el.classList.add("is-shake");
      setTimeout(() => el.classList.remove("is-shake"), 480);
    });
    const skin = currentSkin();
    const view = createRoot.querySelector(`[data-skin-view="${skin}"]`);
    const focusEl = field === "title"
      ? view?.querySelector("[data-ht-create-title]")
      : field === "content"
        ? view?.querySelector("[data-ht-create-content]")
        : view?.querySelector(`[data-ht-shake="openAt"]`);
    if (focusEl) {
      focusEl.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      if (field === "title" || field === "content") focusEl.focus({ preventScroll: true });
    }
  }

  function stopTyping() {
    typeToken++;
    aiBusy = false;
    aiThinking = false;
  }

  function setTitle(val, fromAi = false) {
    if (!fromAi && aiBusy) stopTyping();
    draft.title = clampCodePoints(val, 60);
    errors.title = "";
    saveDraft();
    syncAllViews();
  }

  function setContent(val, fromAi = false) {
    if (!fromAi && aiBusy) stopTyping();
    draft.content = clampCodePoints(val, 5000);
    errors.content = "";
    saveDraft();
    syncAllViews();
  }

  function setOpenAt(msVal, presetKey = null, source = "ext") {
    if (source !== "ai" && aiBusy) stopTyping();
    draft.openAt = msVal;
    draft.preset = presetKey;
    errors.openAt = "";
    if (source !== "dtp") {
      const d = new Date(msVal);
      dtpViewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      dtpClamped = false;
    }
    if (source !== "cal") {
      const d = new Date(msVal);
      paperCalMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    saveDraft();
    syncAllViews();
  }

  createRoot.querySelectorAll("[data-ht-create-title]").forEach((inp) => {
    inp.addEventListener("input", () => setTitle(inp.value, false));
  });
  createRoot.querySelectorAll("[data-ht-create-content]").forEach((ta) => {
    ta.addEventListener("input", () => setContent(ta.value, false));
  });
  createRoot.querySelectorAll("[data-ht-in-plaza]").forEach((chk) => {
    chk.addEventListener("change", () => {
      draft.inPlaza = chk.checked;
      saveDraft();
      syncAllViews();
    });
  });
  createRoot.querySelectorAll("[data-ht-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.htPreset;
      if (!PRESET_AT[key]) return;
      paperDragV = null;
      rulerEl?.classList.add("is-glide");
      setOpenAt(PRESET_AT[key](), key, "preset");
    });
  });

  document.addEventListener("ht:skinchange", () => {
    autoGrowTextareas();
  });

  /* ============================================================
   * 4. AI 推荐与 AI 代笔打字机
   * ============================================================ */
  async function loadRecos() {
    const my = ++recoSeq;
    recoBusy = true;
    syncRecosUi();
    try {
      const r = await apiFetch("/api/v1/capsule-recommendations?count=4");
      if (my !== recoSeq) return;
      if (r && Array.isArray(r.items) && r.items.length > 0) {
        recos = r.items;
      }
    } catch {
      // 推荐失败静默
    } finally {
      if (my === recoSeq) {
        recoBusy = false;
        syncRecosUi();
      }
    }
  }

  async function typeInto(which, text, token) {
    const safeText = clampCodePoints(text, which === "title" ? 60 : 5000);
    if (reducedMotion()) {
      if (which === "title") setTitle(safeText, true);
      else setContent(safeText, true);
      return true;
    }
    const chars = Array.from(safeText);
    const step = which === "title" ? 1 : 3;
    for (let i = 0; i <= chars.length; i += step) {
      if (token !== typeToken) return false;
      const sub = chars.slice(0, i).join("");
      if (which === "title") setTitle(sub, true);
      else setContent(sub, true);
      const prevChar = chars[i - 1] || "";
      await sleep(/[，。？！、—…：\n]/.test(prevChar) ? 45 : 14);
    }
    if (token !== typeToken) return false;
    if (which === "title") setTitle(safeText, true);
    else setContent(safeText, true);
    return true;
  }

  async function aiWrite(forcedTitle) {
    if (aiBusy) return;
    const token = ++typeToken;
    const typed = (forcedTitle != null ? forcedTitle : draft.title).trim();
    const autoTitle = !typed;

    aiBusy = true;
    aiThinking = true;
    aiNote = "";
    errors = { title: "", content: "", openAt: "" };
    if (forcedTitle != null) {
      draft.title = clampCodePoints(forcedTitle, 60);
      saveDraft();
    }
    syncAllViews();

    try {
      const payload = typed ? { title: typed } : {};
      const s = await apiFetch("/api/v1/capsule-suggestion", { method: "POST", json: payload });
      if (token !== typeToken) return;
      aiThinking = false;
      const finalTitle = s.title || typed;
      if (autoTitle && !(await typeInto("title", finalTitle, token))) return;
      if (token !== typeToken) return;

      const suggestedOpen = clamp(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30000, LIMITS.maxOpen());
      setOpenAt(suggestedOpen, null, "ai");
      setContent("", true);
      if (!(await typeInto("content", s.content || "", token))) return;
      if (token !== typeToken) return;

      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      aiNote = `${autoTitle ? "标题与正文均由 AI 代笔" : "已为你代笔"}，建议 ${fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`;
      aiDone = true;
    } catch (err) {
      if (token === typeToken) {
        toast(err instanceof ApiError ? err.message : "AI 暂时没有回应，请稍后再试", { tone: "error" });
      }
    } finally {
      if (token === typeToken) {
        aiBusy = false;
        aiThinking = false;
        syncAllViews();
      }
    }
  }

  createRoot.querySelectorAll("[data-ht-ai-btn]").forEach((btn) => {
    btn.addEventListener("click", () => void aiWrite());
  });
  createRoot.querySelectorAll("[data-ht-reco-refresh]").forEach((btn) => {
    btn.addEventListener("click", () => void loadRecos());
  });
  createRoot.addEventListener("click", (e) => {
    const chip = e.target instanceof Element ? e.target.closest("[data-reco-title]") : null;
    if (chip && !chip.disabled) {
      void aiWrite(chip.dataset.recoTitle);
    }
  });
  window.addEventListener("pagehide", () => { typeToken++; });

  /* ============================================================
   * 5. 校验、封存提交（含长按火漆 X2）与双皮肤成功回执
   * ============================================================ */
  function validate() {
    if (aiBusy) stopTyping();
    if (!draft.title.trim()) {
      errors.title = MSG.title;
      syncAllViews();
      triggerShakeField("title");
      return false;
    }
    if (!draft.content.trim()) {
      errors.content = MSG.content;
      syncAllViews();
      triggerShakeField("content");
      return false;
    }
    if (draft.openAt < LIMITS.minOpen()) {
      errors.openAt = MSG.openMin;
      syncAllViews();
      triggerShakeField("openAt");
      return false;
    }
    if (draft.openAt > LIMITS.maxOpen()) {
      errors.openAt = MSG.openMax;
      syncAllViews();
      triggerShakeField("openAt");
      return false;
    }
    return true;
  }

  function renderReceipts(c) {
    const openAtMs = new Date(c.openAt).getTime();
    const spanText = fmt.span(openAtMs - Date.now());
    const p = paletteOf(c.code);

    // 1) 时笺封缄仪式弹窗
    const paperHost = createRoot.querySelector("[data-ht-paper-ceremony]");
    if (paperHost) {
      const codeSpans = Array.from(c.code).map((ch, i) =>
        `<span style="display:contents"><span style="--i:${i}">${escHtml(ch)}</span>${i === 3 ? "<i></i>" : ""}</span>`
      ).join("");
      const waxSvg = createRoot.querySelector("[data-ht-paper-hold] .wax")?.outerHTML || '<span class="seal seal--solid">封</span>';
      paperHost.innerHTML = `
        <div class="cer" role="dialog" aria-modal="true" aria-label="封缄完成" data-testid="sealed-receipt" data-code="${escHtml(c.code)}">
          <div class="cer__bg"></div>
          <div class="cer__in">
            <div class="cer__stage">
              <div class="env env--cer is-open is-rising" data-cer-env>
                <div class="env__back"></div>
                <div class="env__letter"><b>${escHtml(c.title)}</b><i></i><i></i><i></i><i></i></div>
                <div class="env__front">
                  <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
                    <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z" />
                    <path class="env__shade" d="M1 2.2 50 38 99 2.2" />
                    <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9" />
                    <path class="env__edge" d="M0 0 50 36 100 0" />
                  </svg>
                </div>
                <div class="env__flap">
                  <i class="env__flap-f"><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 50 36 100 0"/></svg></i>
                  <i class="env__flap-b"></i>
                </div>
                <div class="env__seal">${waxSvg.replace("hold__wax", "")}</div>
              </div>
            </div>
            <div class="rcpt">
              <div class="rcpt__k"><span>封存完成</span><i></i><span class="latin">Sealed</span></div>
              <h2 class="rcpt__t serif">《${escHtml(c.title)}》</h2>
              <p class="rcpt__w">将于 <b>${escHtml(fmt.full(openAtMs))}</b> 启封<br/>还要等 ${escHtml(spanText)}</p>
              <div class="rcpt__code mono" aria-label="胶囊码 ${escHtml(c.code)}" data-testid="sealed-code">${codeSpans}</div>
              <p class="rcpt__hint">这 8 位胶囊码是开启它的凭证。${c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}</p>
              <div class="rcpt__act">
                <button class="btn btn--primary" type="button" data-testid="copy-code" data-copy-code="${escHtml(c.code)}">${iconSvg("copy")}复制胶囊码</button>
                <button class="btn btn--ghost" type="button" data-testid="copy-link" data-copy-link="${escHtml(c.code)}">${iconSvg("link")}复制链接</button>
              </div>
              <div class="rcpt__more">
                <a href="/capsules/${encodeURIComponent(c.code)}" data-testid="receipt-view">查看这枚胶囊${iconSvg("arrow")}</a>
                <button class="linkbtn" type="button" data-testid="receipt-again" data-ht-receipt-again>${iconSvg("pen")}再写一枚</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const cer = paperHost.querySelector(".cer");
      const cerEnv = paperHost.querySelector("[data-cer-env]");
      void (async () => {
        const q = reducedMotion();
        await sleep(20);
        if (!cer?.isConnected) return;
        cer.classList.add("is-in");
        await sleep(q ? 0 : 480);
        cerEnv?.classList.remove("is-rising");
        await sleep(q ? 0 : 680);
        cerEnv?.classList.remove("is-open");
        await sleep(q ? 0 : 680);
        cer.classList.add("is-stamped");
        await sleep(q ? 0 : 600);
        if (!cer?.isConnected) return;
        cer.classList.add("is-done");
      })();
    }

    // 2) 琥珀封存回执卡
    const amberSealed = createRoot.querySelector("[data-ht-amber-sealed]");
    const amberFormArea = createRoot.querySelector("[data-ht-amber-form-area]");
    if (amberFormArea) setSubtreeUnhooked(amberFormArea, true);
    if (amberSealed) {
      const tiles = Array.from(c.code).map((ch, i) =>
        `<span class="tile${i === 4 ? " has-gap" : ""}" style="--i:${i}">${escHtml(ch)}</span>`
      ).join("");
      const visBadge = c.inPlaza
        ? `<span class="badge badge--plaza">${iconSvg("globe")}广场公开</span>`
        : `<span class="badge badge--private">${iconSvg("lock")}仅凭码可见</span>`;
      amberSealed.hidden = false;
      amberSealed.innerHTML = `
        <section class="sealed card" style="--glow:${p.glow}" data-testid="sealed-receipt" data-code="${escHtml(c.code)}">
          <div class="sealed__art">
            <svg class="cart cart--opened" data-amber-rcpt-cart width="260" height="130" viewBox="0 0 240 120" style="--cap-glow:${p.glow}" aria-hidden="true">
              <defs>
                <linearGradient id="rcptca1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.capLight}"/><stop offset="1" stop-color="${p.capDeep}"/></linearGradient>
                <linearGradient id="rcptca2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".42"/></linearGradient>
              </defs>
              <ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6"/>
              <g class="cart__paper"><rect x="98" y="24" width="44" height="62" rx="5"/><path d="M106 40h28M106 50h28M106 60h17"/></g>
              <g class="cart__cap"><path d="M120 30H60a30 30 0 0 0 0 60h60Z" fill="url(#rcptca1)"/><path class="cart__groove" d="M104 31v58M111 31v58"/><path class="cart__shine" d="M60 41h36"/></g>
              <g class="cart__body"><path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" fill="url(#rcptca2)"/><rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6"/><path class="cart__scroll-line" d="M141 56h30M141 64h19"/><path class="cart__shine" d="M132 40h40"/></g>
              <rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5"/>
              <circle class="cart__lock" cx="120" cy="60" r="4.5"/>
            </svg>
          </div>
          <div class="eyebrow eyebrow--center">Sealed</div>
          <h1 class="page-title">封存完成</h1>
          <p class="page-lead">下面这串胶囊码是开启它的钥匙，${c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}</p>
          <div class="tiles mono" aria-label="胶囊码 ${escHtml(c.code)}" data-testid="sealed-code">${tiles}</div>
          <div class="sealed__act">
            <button class="btn btn--primary" type="button" data-testid="copy-code" data-copy-code="${escHtml(c.code)}">${iconSvg("copy")}复制胶囊码</button>
            <button class="btn btn--ghost" type="button" data-testid="copy-link" data-copy-link="${escHtml(c.code)}">${iconSvg("link")}复制链接</button>
          </div>
          <dl class="sealed__meta">
            <div><dt>标题</dt><dd>${escHtml(c.title)}</dd></div>
            <div><dt>开启时间</dt><dd class="mono">${escHtml(fmt.dashDateTime(openAtMs))}</dd></div>
            <div><dt>沉睡时长</dt><dd>${escHtml(spanText)}</dd></div>
            <div><dt>属性</dt><dd>${visBadge}</dd></div>
          </dl>
          <div class="sealed__links">
            <a class="link-btn" href="/capsules/${encodeURIComponent(c.code)}" data-testid="receipt-view">查看这枚胶囊${iconSvg("arrow")}</a>
            <button class="link-btn" type="button" data-testid="receipt-again" data-ht-receipt-again>再写一枚${iconSvg("plus")}</button>
            <a class="link-btn" href="/me/created">我创建的${iconSvg("feather")}</a>
          </div>
        </section>
      `;
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const sec = amberSealed.querySelector(".sealed");
        const cart = amberSealed.querySelector("[data-amber-rcpt-cart]");
        sec?.classList.add("is-in");
        cart?.classList.remove("cart--opened");
        cart?.classList.add("cart--locked");
      }));
    }

    syncSkinDom(createRoot);
  }

  function resetAfterAgain() {
    createdCapsule = null;
    draft = freshDraft();
    errors = { title: "", content: "", openAt: "" };
    aiDone = false;
    aiNote = "";
    saveDraft();

    const paperHost = createRoot.querySelector("[data-ht-paper-ceremony]");
    if (paperHost) paperHost.innerHTML = "";
    const amberSealed = createRoot.querySelector("[data-ht-amber-sealed]");
    if (amberSealed) { amberSealed.hidden = true; amberSealed.innerHTML = ""; }
    const amberFormArea = createRoot.querySelector("[data-ht-amber-form-area]");
    if (amberFormArea) setSubtreeUnhooked(amberFormArea, false);

    resetPaperHoldUi();
    syncAllViews();
    syncSkinDom(createRoot);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  createRoot.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-ht-receipt-again]")) {
      resetAfterAgain();
    }
  });

  function setSubmittingUi(busy) {
    const amberBtn = createRoot.querySelector("[data-ht-amber-submit]");
    const amberTxt = createRoot.querySelector("[data-ht-amber-submit-text]");
    if (amberBtn) {
      amberBtn.disabled = busy;
      amberBtn.classList.toggle("is-busy", busy);
    }
    if (amberTxt) amberTxt.textContent = busy ? "正在封存…" : "封存胶囊";
    const holdHint = createRoot.querySelector("[data-ht-hold-hint]");
    if (holdHint && busy) holdHint.textContent = "正在封缄…";
  }

  async function submitCapsule() {
    if (submitPending || !validate()) return null;
    submitPending = true;
    setSubmittingUi(true);
    const snapshot = Object.assign({}, draft);
    try {
      const c = await apiFetch("/api/v1/capsules", {
        method: "POST",
        json: {
          title: snapshot.title.trim(),
          content: snapshot.content,
          openAt: new Date(snapshot.openAt).toISOString(),
          inPlaza: snapshot.inPlaza,
        },
      });
      createdCapsule = c;
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      renderReceipts(c);
      return c;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "封存失败，请稍后再试", { tone: "error" });
      return null;
    } finally {
      submitPending = false;
      setSubmittingUi(false);
    }
  }

  // 琥珀表单直接提交
  createRoot.querySelector("[data-ht-amber-create-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitCapsule();
  });

  // 时笺长按火漆按钮（支持指针与键盘空格，完成由 setTimeout 驱动，后台标签页不卡）
  const HOLD_MS = 1150;
  const holdBtn = createRoot.querySelector("[data-ht-paper-hold]");
  const holdHint = createRoot.querySelector("[data-ht-hold-hint]");
  let holding = false;
  let holdDone = false;
  let holdTimer = 0;
  let holdRaf = 0;
  let holdT0 = 0;

  function resetPaperHoldUi(hintText = "长按火漆，封缄") {
    holding = false;
    holdDone = false;
    clearTimeout(holdTimer);
    cancelAnimationFrame(holdRaf);
    if (holdBtn) {
      holdBtn.classList.remove("is-holding", "is-done", "is-shake");
      holdBtn.style.setProperty("--hp", "0");
    }
    if (holdHint) holdHint.textContent = hintText;
  }

  if (holdBtn) {
    const drawFrame = (t) => {
      if (!holding) return;
      holdBtn.style.setProperty("--hp", clamp((t - holdT0) / HOLD_MS, 0, 1).toFixed(3));
      holdRaf = requestAnimationFrame(drawFrame);
    };

    const completeHold = () => {
      if (!holding) return;
      holding = false;
      holdDone = true;
      cancelAnimationFrame(holdRaf);
      holdBtn.style.setProperty("--hp", "1");
      holdBtn.classList.remove("is-holding");
      holdBtn.classList.add("is-done");
      void submitCapsule().then((c) => {
        if (!c) resetPaperHoldUi("长按火漆，封缄");
      });
    };

    const startHold = () => {
      if (holding || holdDone || submitPending) return;
      if (!validate()) return;
      holding = true;
      holdT0 = performance.now();
      holdBtn.classList.add("is-holding");
      if (holdHint) holdHint.textContent = "按住，别松手…";
      holdRaf = requestAnimationFrame(drawFrame);
      holdTimer = window.setTimeout(completeHold, HOLD_MS);
    };

    const cancelHold = () => {
      if (!holding) return;
      const quick = performance.now() - holdT0 < 320;
      resetPaperHoldUi(quick ? "要按住约 1 秒才会封缄" : "长按火漆，封缄");
      if (quick) {
        holdBtn.classList.add("is-shake");
        setTimeout(() => holdBtn.classList.remove("is-shake"), 480);
      }
    };

    holdBtn.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      e.preventDefault();
      holdBtn.focus({ preventScroll: true });
      try { holdBtn.setPointerCapture(e.pointerId); } catch {}
      startHold();
    });
    holdBtn.addEventListener("pointerup", cancelHold);
    holdBtn.addEventListener("pointercancel", cancelHold);
    holdBtn.addEventListener("lostpointercapture", cancelHold);
    holdBtn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        startHold();
      }
    });
    holdBtn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") cancelHold();
    });
    holdBtn.addEventListener("blur", cancelHold);
    holdBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // 初始化渲染与焦点
  syncAllViews();
  void loadRecos();
  setInterval(() => {
    if (!createdCapsule) syncAllViews();
  }, 15000);
  setTimeout(() => {
    const view = createRoot.querySelector(`[data-skin-view="${currentSkin()}"]`);
    focusIfIdle(view?.querySelector("[data-ht-create-title]"));
  }, 380);
})();
