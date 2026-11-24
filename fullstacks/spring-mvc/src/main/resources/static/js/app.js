/* ============================================================
 * HelloTime Pro · Spring MVC 全栈客户端渐进增强（2.0）
 *
 * 服务端由 Thymeleaf 直出双皮肤 HTML，HTMX 负责局部片段替换；
 * 本脚本负责：
 *   1. 双皮肤 DOM 钩子唯一性同步（满足 spec/ui/testids.md §1.4）
 *   2. 皮肤「柔光拂过」与明暗圆形转场、琥珀星空画布、分段滑块定位
 *   3. Toast、ConfirmDialog（X6/X7）、匿名创建与收藏拦截、复制分享
 *   4. 8 格输码（双皮肤共享状态、整码覆盖防坑）、广场 HTMX 防抖与错误兜底
 *   5. 胶囊详情实时倒计时与归零自动启封（退避轮询确认服务端 isOpened）
 *   6. 登录 / 注册 / 个人中心（列表删除、分页前移去重补齐、资料与改密）
 * ============================================================ */
(function () {
  "use strict";

  const root = document.documentElement;
  const THEME_COLORS = {
    paper: { light: "#F3EFE5", dark: "#131210" },
    amber: { light: "#faf5ea", dark: "#080b1a" },
  };
  const SKIN_LABELS = { paper: "时笺", amber: "琥珀" };

  const ICONS = {
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 4 21 19.5H3L12 4z"/><path d="M12 10v4.5M12 17v.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M4 4l16 16M9.9 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.3 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.6-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
    pen: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z"/><path d="m14.5 6 3 3"/>',
    sparkle: '<path d="M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4L20.5 12 15 13.6a2 2 0 0 0-1.4 1.4L12 20.5 10.4 15A2 2 0 0 0 9 13.6L3.5 12 9 10.4A2 2 0 0 0 10.4 9L12 3.5z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    feather: '<path d="M20 4c-6 0-11.5 4.5-12.5 11.5L5 20"/><path d="M8 15.5h6.5M11 11.5h6"/>',
  };

  function iconSvg(name, extraClass) {
    const cls = extraClass ? `ic ${extraClass}` : "ic";
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  const pad2 = (n) => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = (t) => new Promise((r) => setTimeout(r, t));
  const reducedMotion = () =>
    !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const escHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function focusIfIdle(el) {
    const a = document.activeElement;
    if (el && (!a || a === document.body)) el.focus({ preventScroll: true });
  }

  function addCalendarYears(t, n) {
    const d = new Date(t);
    const out = new Date(t);
    out.setUTCFullYear(d.getUTCFullYear() + n);
    if (out.getUTCMonth() !== d.getUTCMonth()) out.setUTCDate(0);
    return out.getTime();
  }

  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  const LUNAR_MONTH = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function lunarDay(n) {
    if (n <= 10) return "初" + CN_NUM[n];
    if (n < 20) return "十" + CN_NUM[n - 10];
    if (n === 20) return "二十";
    if (n < 30) return "廿" + CN_NUM[n - 20];
    return "三十";
  }

  const fmt = {
    date(t) {
      const d = new Date(t);
      return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
    },
    dashDate(t) {
      return fmt.date(t).replace(/\./g, "-");
    },
    time(t, sec = false) {
      const d = new Date(t);
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}${sec ? ":" + pad2(d.getSeconds()) : ""}`;
    },
    dateTime(t) {
      return fmt.date(t) + " " + fmt.time(t);
    },
    dashDateTime(t) {
      return fmt.dashDate(t) + " " + fmt.time(t);
    },
    cn(t) {
      const d = new Date(t);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    },
    week(t) {
      return "星期" + WEEK[new Date(t).getDay()];
    },
    full(t) {
      return `${fmt.cn(t)} ${fmt.week(t)} ${fmt.time(t)}`;
    },
    num(n) {
      return Number(n).toLocaleString("zh-CN");
    },
    lunar(t) {
      try {
        const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).formatToParts(new Date(t));
        const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
        const year = get("yearName");
        let month = get("month");
        let day = get("day");
        if (/^\d+$/.test(month)) month = LUNAR_MONTH[+month - 1];
        if (month && !/月$/.test(month)) month += "月";
        if (/^\d+$/.test(day)) day = lunarDay(+day);
        return (year ? year + "年" : "") + month + day;
      } catch {
        return "";
      }
    },
    span(msVal) {
      const m = Math.max(0, Math.round(msVal / 60000));
      if (m < 1) return "不到 1 分钟";
      if (m < 60) return m + " 分钟";
      if (m < 1440) {
        const h = Math.floor(m / 60);
        const r = m % 60;
        return r && h < 6 ? `${h} 小时 ${r} 分` : `${Math.round(m / 60)} 小时`;
      }
      const days = Math.round(m / 1440);
      if (days < 60) return days + " 天";
      if (days < 360) return Math.round(days / 30.44) + " 个月";
      let y = Math.floor(days / 365.25);
      let mo = Math.round((days - y * 365.25) / 30.44);
      if (mo >= 12) {
        y += 1;
        mo = 0;
      }
      if (y === 0) return "1 年";
      return mo ? `${y} 年 ${mo} 个月` : `${y} 年`;
    },
    cd(openAtMs, now = Date.now()) {
      const t = Math.max(0, Math.floor((openAtMs - now) / 1000));
      return {
        expired: openAtMs <= now,
        total: t,
        d: Math.floor(t / 86400),
        h: Math.floor((t % 86400) / 3600),
        m: Math.floor((t % 3600) / 60),
        s: t % 60,
      };
    },
    progress(createdAtMs, openAtMs, now = Date.now()) {
      const span = openAtMs - createdAtMs;
      if (span <= 0) return 100;
      return clamp(Math.round(((now - createdAtMs) / span) * 100), 0, 100);
    },
  };

  function paletteOf(code) {
    let hue = 68;
    let hue2 = 300;
    if (code) {
      let h = 0x811c9dc5;
      for (let i = 0; i < code.length; i++) {
        h ^= code.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      const u = h >>> 0;
      hue = u % 360;
      hue2 = (hue + 40 + ((u >>> 9) % 41)) % 360;
    }
    return {
      hue,
      capLight: `oklch(0.84 0.14 ${hue})`,
      capDeep: `oklch(0.63 0.19 ${hue})`,
      accent: `oklch(0.78 0.13 ${hue2})`,
      glow: `oklch(0.72 0.17 ${hue} / 0.34)`,
    };
  }

  let avatarList = [];
  try {
    const raw = document.getElementById("ht-avatars-data")?.textContent;
    if (raw) avatarList = JSON.parse(raw);
  } catch {}
  function avatarOf(id) {
    return avatarList.find((a) => a.id === id) || avatarList[0] || { id: "neo", name: "新生", primaryColor: "#4a7c59", tagline: "", glyph: "" };
  }

  /* ============================================================
   * 1. 双皮肤 DOM 钩子唯一性同步（spec/ui/testids.md §1.4）
   * ============================================================ */
  function currentSkin() {
    return root.dataset.skin === "paper" ? "paper" : "amber";
  }
  function currentTheme() {
    return root.dataset.theme === "light" ? "light" : "dark";
  }

  function isElementActiveForSkin(el, skin) {
    if (el.closest("[data-ht-unhooked='true']")) return false;
    const view = el.closest("[data-skin-view]");
    return !view || view.dataset.skinView === skin;
  }

  function syncSkinDom(scope = document) {
    const skin = currentSkin();
    const views = [];
    if (scope !== document && scope.matches && scope.matches("[data-skin-view]")) {
      views.push(scope);
    }
    scope.querySelectorAll?.("[data-skin-view]").forEach((v) => views.push(v));

    views.forEach((view) => {
      const active = view.dataset.skinView === skin;
      view.hidden = !active;
      view.querySelectorAll("[data-testid], [data-ht-testid]").forEach((el) => {
        if (!el.dataset.htTestid && el.dataset.testid) {
          el.dataset.htTestid = el.dataset.testid;
        }
        if (active && !el.closest("[data-ht-unhooked='true']") && el.dataset.htTestid) {
          el.dataset.testid = el.dataset.htTestid;
        } else {
          el.removeAttribute("data-testid");
        }
      });
      view.querySelectorAll("[data-code-cell], [data-ht-code-cell]").forEach((el) => {
        if (!("htCodeCell" in el.dataset)) {
          el.dataset.htCodeCell = "";
        }
        if (active && !el.closest("[data-ht-unhooked='true']")) {
          el.setAttribute("data-code-cell", "");
        } else {
          el.removeAttribute("data-code-cell");
        }
      });
    });

    syncShellControls();
  }

  function setHook(el, testId) {
    if (!el) return;
    if (testId) {
      el.dataset.htTestid = testId;
      if (isElementActiveForSkin(el, currentSkin())) {
        el.dataset.testid = testId;
      } else {
        el.removeAttribute("data-testid");
      }
    } else {
      delete el.dataset.htTestid;
      el.removeAttribute("data-testid");
    }
  }

  function setSubtreeUnhooked(el, unhooked) {
    if (!el) return;
    el.hidden = !!unhooked;
    if (unhooked) el.dataset.htUnhooked = "true";
    else delete el.dataset.htUnhooked;
    const view = el.closest("[data-skin-view]") || document;
    syncSkinDom(view);
  }

  function syncShellControls() {
    const skin = currentSkin();
    const theme = currentTheme();
    document.querySelectorAll("[data-ht-skin-opt]").forEach((btn) => {
      const on = btn.dataset.value === skin;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-checked", String(on));
      btn.dataset.selected = String(on);
    });
    document.querySelectorAll("[data-ht-theme-btn]").forEach((btn) => {
      if (btn.classList.contains("theme-toggle")) {
        const isLight = theme === "light";
        btn.setAttribute("aria-checked", String(isLight));
        btn.setAttribute("aria-label", isLight ? "当前为晨曦（亮色），切换到星夜" : "当前为星夜（暗色），切换到晨曦");
      } else {
        btn.setAttribute("aria-label", theme === "dark" ? "切换到日间主题" : "切换到夜间主题");
      }
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = THEME_COLORS[skin]?.[theme];
    if (meta && color) meta.setAttribute("content", color);
  }

  // 首帧解析完成立即同步钩子！
  syncSkinDom(document);

  /* ============================================================
   * 2. API 请求封装
   * ============================================================ */
  class ApiError extends Error {
    constructor(status, errorCode, message, details) {
      super(message || "请求失败");
      this.status = status;
      this.errorCode = errorCode;
      this.details = details || [];
    }
  }

  async function apiFetch(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      signal: options.signal,
      credentials: "same-origin",
    });
    if (res.status === 204) return null;
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      throw new ApiError(res.status, "INTERNAL_ERROR", "响应格式异常", []);
    }
    if (!res.ok || !payload?.success) {
      throw new ApiError(
        res.status,
        payload?.errorCode || "INTERNAL_ERROR",
        payload?.message || "请求失败",
        payload?.details || []
      );
    }
    return payload.data;
  }

  /* ============================================================
   * 3. Toast 与 ConfirmDialog（X6 / X7）
   * ============================================================ */
  function toast(text, opts = {}) {
    const tone = opts.tone || "success";
    const box = document.getElementById("ht-toasts");
    if (!box) return;
    const cls = tone === "error" ? "toast--err" : tone === "info" ? "toast--info" : "toast--ok";
    const ic = tone === "error" ? "alert" : tone === "info" ? "info" : "check";
    const el = document.createElement("div");
    el.className = `toast ${cls}`;
    el.dataset.testid = "toast";
    el.dataset.tone = tone;
    el.innerHTML = `${iconSvg(ic)}<span>${escHtml(text)}</span>`;
    box.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
    const dur = opts.duration || 2600;
    setTimeout(() => {
      el.classList.remove("is-in");
      setTimeout(() => el.remove(), 400);
    }, dur);
  }

  function pushFlashToast(text, tone = "success") {
    try {
      sessionStorage.setItem("ht_flash_toast", JSON.stringify({ text, tone }));
    } catch {}
  }

  try {
    const flash = sessionStorage.getItem("ht_flash_toast");
    if (flash) {
      sessionStorage.removeItem("ht_flash_toast");
      const parsed = JSON.parse(flash);
      if (parsed?.text) toast(parsed.text, { tone: parsed.tone || "success" });
    }
  } catch {}

  let activeDialogClose = null;
  function confirmDialog(opts) {
    if (activeDialogClose) activeDialogClose(false);
    return new Promise((resolve) => {
      const host = document.getElementById("ht-dialog-root");
      if (!host) return resolve(false);
      const prevFocus = document.activeElement;
      const skin = currentSkin();
      const markHtml = skin === "paper" ? (opts.markPaper || "") : (opts.markAmber || "");
      const okCls = opts.tone === "danger" ? "btn--danger" : "btn--primary";

      const wrap = document.createElement("div");
      wrap.className = "dlg";
      wrap.innerHTML = `
        <div class="dlg__scrim"></div>
        <div class="dlg__card" role="dialog" aria-modal="true" aria-labelledby="ht-dlg-title" data-testid="confirm-dialog">
          ${markHtml}
          <h2 id="ht-dlg-title" class="dlg__t">${escHtml(opts.title)}</h2>
          <div class="dlg__b">${opts.bodyHtml || ""}</div>
          <div class="dlg__act">
            <button class="btn btn--ghost" type="button" data-testid="confirm-cancel">${escHtml(opts.cancel || "取消")}</button>
            <button class="btn ${okCls}" type="button" data-testid="confirm-ok">${escHtml(opts.confirm || "确定")}</button>
          </div>
        </div>
      `;
      host.innerHTML = "";
      host.appendChild(wrap);

      const okBtn = wrap.querySelector('[data-testid="confirm-ok"]');
      const cancelBtn = wrap.querySelector('[data-testid="confirm-cancel"]');
      const scrim = wrap.querySelector(".dlg__scrim");
      const card = wrap.querySelector(".dlg__card");

      let closed = false;
      function close(result) {
        if (closed) return;
        closed = true;
        activeDialogClose = null;
        document.removeEventListener("keydown", onKeyDown, true);
        wrap.remove();
        if (prevFocus && typeof prevFocus.focus === "function") {
          try { prevFocus.focus({ preventScroll: true }); } catch {}
        }
        resolve(result);
      }
      activeDialogClose = close;

      function onKeyDown(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close(false);
          return;
        }
        if (e.key === "Tab" && card) {
          const focusables = Array.from(card.querySelectorAll("button:not([disabled]), a[href], input:not([disabled])"));
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      document.addEventListener("keydown", onKeyDown, true);
      scrim.addEventListener("click", () => close(false));
      cancelBtn.addEventListener("click", () => close(false));
      okBtn.addEventListener("click", () => close(true));

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          wrap.classList.add("is-in");
          okBtn.focus({ preventScroll: true });
        });
      });
    });
  }

  async function askLoginForCreate() {
    const ok = await confirmDialog({
      title: "登录后才能写胶囊",
      bodyHtml: "<p>胶囊会存在你的账号下：之后在「我的」里随时能找到它、复制胶囊码，或者删除它。</p>",
      confirm: "去登录",
      cancel: "再逛逛",
      markPaper: '<div class="dlg__mark"><span class="seal seal--line" aria-hidden="true">缄</span></div>',
      markAmber: `<div class="dlg__mark">${iconSvg("pen")}</div>`,
    });
    if (ok) window.location.href = "/login?redirect=%2Fcreate";
  }

  async function askLoginForFav() {
    const ok = await confirmDialog({
      title: "登录后才能收藏",
      bodyHtml: "<p>收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。</p>",
      confirm: "去登录",
      cancel: "再逛逛",
      markPaper: '<div class="dlg__mark"><span class="seal seal--line" aria-hidden="true">藏</span></div>',
      markAmber: `<div class="dlg__mark">${iconSvg("heart")}</div>`,
    });
    if (ok) {
      const back = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${back}`;
    }
  }

  async function copyText(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast(successMsg);
    } catch {
      toast("复制失败，请手动复制", { tone: "error" });
    }
  }

  /* ============================================================
   * 4. 皮肤切换、明暗切换、滑块定位、琥珀星空
   * ============================================================ */
  function placeSegThumb(seg, animate = false) {
    const thumb = seg.querySelector(".seg__thumb");
    const active = seg.querySelector(".seg__opt.is-active");
    if (!thumb || !active) return;
    if (!animate) thumb.style.transition = "none";
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate) {
      requestAnimationFrame(() => { thumb.style.transition = ""; });
    }
  }

  function placeAllIndicators(animate = false) {
    document.querySelectorAll("[data-ht-amber-nav]").forEach((nav) => {
      const ink = nav.querySelector(".nav__ink");
      const active = nav.querySelector(".nav__link.is-active");
      if (!ink) return;
      if (!active || active.offsetWidth === 0) {
        ink.style.opacity = "0";
        return;
      }
      ink.style.transition = animate ? "" : "none";
      ink.style.opacity = "1";
      ink.style.width = `${active.offsetWidth}px`;
      ink.style.transform = `translateX(${active.offsetLeft}px)`;
    });

    document.querySelectorAll("[data-ht-seg]").forEach((seg) => {
      if (seg.offsetParent !== null) placeSegThumb(seg, animate);
    });

    document.querySelectorAll("[data-ht-paper-tabs]").forEach((tabs) => {
      const ink = tabs.querySelector(".tabs__ink");
      const active = tabs.querySelector(".tabs__it.is-active");
      if (!ink || !active || active.offsetWidth === 0) return;
      ink.style.transition = animate ? "" : "none";
      ink.style.width = `${active.offsetWidth}px`;
      ink.style.transform = `translateX(${active.offsetLeft}px)`;
    });
  }

  let currentVt = null;
  function setSkin(nextSkin) {
    if (nextSkin !== "paper" && nextSkin !== "amber") return;
    if (nextSkin === currentSkin()) return;

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      root.setAttribute("data-skin", nextSkin);
      try { localStorage.setItem("hellotime.skin", nextSkin); } catch {}
      syncSkinDom(document);
      placeAllIndicators(false);
      restartSky();
      document.dispatchEvent(new CustomEvent("ht:skinchange", { detail: { skin: nextSkin } }));
    };

    if (currentVt) {
      try { currentVt.skipTransition(); } catch {}
    }
    delete root.dataset.skinDir;
    root.classList.remove("is-skinning", "is-theming");

    if (reducedMotion() || !document.startViewTransition) {
      apply();
      toast(`已切换到「${SKIN_LABELS[nextSkin]}」`);
      return;
    }

    root.dataset.skinDir = nextSkin === "paper" ? "prev" : "next";
    root.classList.add("is-skinning");
    const vt = document.startViewTransition(apply);
    currentVt = vt;
    const fallback = setTimeout(apply, 400);
    vt.finished
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        if (currentVt === vt) {
          root.classList.remove("is-skinning");
          delete root.dataset.skinDir;
          currentVt = null;
        }
        toast(`已切换到「${SKIN_LABELS[nextSkin]}」`);
      });
  }

  function toggleTheme(event) {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    const kb = event.clientX === 0 && event.clientY === 0;
    const x = kb ? rect.left + rect.width / 2 : event.clientX;
    const y = kb ? rect.top + rect.height / 2 : event.clientY;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      root.setAttribute("data-theme", nextTheme);
      try { localStorage.setItem("hellotime.theme", nextTheme); } catch {}
      syncShellControls();
      restartSky();
      document.dispatchEvent(new CustomEvent("ht:themechange", { detail: { theme: nextTheme } }));
    };

    if (currentVt) {
      try { currentVt.skipTransition(); } catch {}
    }
    root.classList.remove("is-skinning", "is-theming");

    if (reducedMotion() || !document.startViewTransition) {
      apply();
      return;
    }

    root.classList.add("is-theming");
    const vt = document.startViewTransition(apply);
    currentVt = vt;
    const fallback = setTimeout(apply, 400);
    vt.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 600, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(() => {});
    vt.finished
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        if (currentVt === vt) {
          root.classList.remove("is-theming");
          currentVt = null;
        }
      });
  }

  // 琥珀星空粒子画布
  let stopSkyFn = null;
  function startSky(canvas, dark) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const STAR = ["255,255,255", "255,255,255", "200,214,255", "255,226,180"];
    const MOTE = ["236,150,40", "245,176,66", "214,120,60", "160,130,240"];
    let w = 0, h = 0, frame = 0;
    let parts = [];
    let meteor = null;
    let nextMeteor = performance.now() + 3000 + Math.random() * 4000;

    function populate() {
      const n = Math.max(70, Math.min(dark ? 230 : 90, Math.round((w * h) / (dark ? 7000 : 20000))));
      const r = Math.random;
      parts = Array.from({ length: n }, () =>
        dark
          ? { x: r() * w, y: r() * h, r: r() < 0.08 ? 1.3 + r() * 0.8 : 0.35 + r() * 0.85, a: 0.3 + r() * 0.6, sp: 0.4 + r() * 1.6, ph: r() * 6.28, vx: 0.012 + r() * 0.03, vy: 0, c: STAR[(r() * STAR.length) | 0] }
          : { x: r() * w, y: r() * h, r: 1 + r() * 3.2, a: 0.1 + r() * 0.26, sp: 0.2 + r() * 0.7, ph: r() * 6.28, vx: (r() - 0.5) * 0.12, vy: -(0.05 + r() * 0.2), c: MOTE[(r() * MOTE.length) | 0] }
      );
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      populate();
    }

    function drawMeteor(now) {
      if (!meteor && now >= nextMeteor) {
        meteor = { x: w * (0.35 + Math.random() * 0.6), y: -20, vx: -(5 + Math.random() * 3), vy: 3 + Math.random() * 2, life: 0, max: 70 + Math.random() * 30 };
      }
      if (!meteor) return;
      meteor.x += meteor.vx;
      meteor.y += meteor.vy;
      meteor.life += 1;
      const fade = Math.sin((meteor.life / meteor.max) * Math.PI);
      const tx = meteor.x - meteor.vx * 16, ty = meteor.y - meteor.vy * 16;
      const g = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
      g.addColorStop(0, `rgba(255,244,220,${0.9 * fade})`);
      g.addColorStop(1, "rgba(255,244,220,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (meteor.life >= meteor.max) {
        meteor = null;
        nextMeteor = now + 6000 + Math.random() * 9000;
      }
    }

    function draw(now) {
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        let a = p.a;
        if (dark) {
          a *= 0.55 + 0.45 * Math.sin(t * p.sp + p.ph);
          p.x += p.vx;
          if (p.x > w + 4) p.x = -4;
        } else {
          p.x += p.vx + Math.sin(t * p.sp + p.ph) * 0.12;
          p.y += p.vy;
          if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
          if (p.x < -8) p.x = w + 8;
          if (p.x > w + 8) p.x = -8;
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.c},${Math.max(0, a).toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      if (dark) drawMeteor(now);
      frame = requestAnimationFrame(draw);
    }

    function play() {
      cancelAnimationFrame(frame);
      if (reducedMotion()) {
        draw(performance.now());
        cancelAnimationFrame(frame);
      } else if (!document.hidden) {
        frame = requestAnimationFrame(draw);
      }
    }

    resize();
    play();
    const onVis = () => (document.hidden ? cancelAnimationFrame(frame) : play());
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      ctx.clearRect(0, 0, w, h);
    };
  }

  function restartSky() {
    if (stopSkyFn) { stopSkyFn(); stopSkyFn = null; }
    const canvas = document.getElementById("ht-sky-canvas");
    if (canvas && currentSkin() === "amber") {
      stopSkyFn = startSky(canvas, currentTheme() !== "light");
    }
  }

  /* ============================================================
   * 5. 全局事件绑定（导航滚动、用户菜单、登出、收藏、复制）
   * ============================================================ */
  function updateHeaderScroll() {
    const scrolled = window.scrollY > 6;
    document.querySelectorAll("[data-ht-header]").forEach((h) => h.classList.toggle("is-scrolled", scrolled));
  }
  window.addEventListener("scroll", updateHeaderScroll, { passive: true });
  window.addEventListener("resize", () => placeAllIndicators(false));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => placeAllIndicators(false));
  }
  updateHeaderScroll();
  placeAllIndicators(false);
  restartSky();

  document.querySelectorAll("[data-ht-skin-opt]").forEach((btn) => {
    btn.addEventListener("click", () => setSkin(btn.dataset.value));
  });
  document.querySelectorAll("[data-ht-theme-btn]").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });

  function closeAllMenus() {
    document.querySelectorAll("[data-ht-umenu]").forEach((m) => {
      m.classList.remove("is-open");
      m.querySelector("[data-ht-umenu-btn]")?.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    // 用户菜单开关
    const menuBtn = target.closest("[data-ht-umenu-btn]");
    if (menuBtn) {
      const menu = menuBtn.closest("[data-ht-umenu]");
      const next = !menu.classList.contains("is-open");
      closeAllMenus();
      menu.classList.toggle("is-open", next);
      menuBtn.setAttribute("aria-expanded", String(next));
      return;
    }
    if (!target.closest("[data-ht-umenu]")) {
      closeAllMenus();
    }

    // 登出
    if (target.closest("[data-ht-logout]")) {
      e.preventDefault();
      void (async () => {
        try {
          await apiFetch("/api/v1/auth/logout", { method: "POST", json: {} });
        } catch {}
        try { sessionStorage.removeItem("hellotime.draft"); } catch {}
        pushFlashToast("已登出", "success");
        window.location.href = "/";
      })();
      return;
    }

    // 匿名点击创建入口
    const createLink = target.closest("[data-require-login='create']");
    if (createLink && document.body.dataset.authenticated !== "true") {
      e.preventDefault();
      void askLoginForCreate();
      return;
    }

    // 平滑滚动到广场
    if (target.closest("[data-ht-scroll-plaza]")) {
      e.preventDefault();
      document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      return;
    }

    // 复制胶囊码 / 链接
    const copyCodeBtn = target.closest("[data-copy-code]");
    if (copyCodeBtn) {
      e.preventDefault();
      const code = copyCodeBtn.dataset.copyCode;
      void copyText(code, `已复制胶囊码 ${code}`);
      return;
    }
    const copyLinkBtn = target.closest("[data-copy-link]");
    if (copyLinkBtn) {
      e.preventDefault();
      const code = copyLinkBtn.dataset.copyLink;
      void copyText(`${window.location.origin}/capsules/${code}`, "已复制分享链接");
      return;
    }

    // 密码明暗眼睛切换
    const eyeBtn = target.closest("[data-ht-pwd-eye]");
    if (eyeBtn) {
      e.preventDefault();
      const box = eyeBtn.closest("[data-ht-field-box]");
      const input = box?.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      const syncKey = input.dataset.htSync;
      const targets = syncKey ? document.querySelectorAll(`input[data-ht-sync="${syncKey}"]`) : [input];
      targets.forEach((inp) => {
        inp.type = show ? "text" : "password";
        const b = inp.closest("[data-ht-field-box]")?.querySelector("[data-ht-pwd-eye]");
        if (b) {
          b.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
          b.innerHTML = iconSvg(show ? "eye-off" : "eye");
        }
      });
      return;
    }

    // 收藏按钮
    const favBtn = target.closest("[data-ht-fav-btn]");
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (document.body.dataset.authenticated !== "true") {
        void askLoginForFav();
        return;
      }
      if (favBtn.dataset.busy === "1") return;
      const capsuleId = favBtn.dataset.capsuleId;
      const wasOn = favBtn.getAttribute("aria-pressed") === "true";
      const allBtns = document.querySelectorAll(`[data-ht-fav-btn][data-capsule-id="${capsuleId}"]`);
      allBtns.forEach((b) => (b.dataset.busy = "1"));

      void (async () => {
        try {
          let nextOn = !wasOn;
          let nextCount = Math.max(0, (parseInt(favBtn.dataset.count, 10) || 0) + (nextOn ? 1 : -1));
          if (wasOn) {
            await apiFetch(`/api/v1/me/favorites/${capsuleId}`, { method: "DELETE" });
            toast("已取消收藏");
          } else {
            const r = await apiFetch("/api/v1/me/favorites", { method: "POST", json: { capsuleId } });
            if (r && typeof r.favoriteCount === "number") nextCount = r.favoriteCount;
          }
          allBtns.forEach((b) => {
            b.setAttribute("aria-pressed", String(nextOn));
            b.dataset.count = String(nextCount);
            b.classList.toggle("is-on", nextOn);
            b.setAttribute("aria-label", `${nextOn ? "取消收藏，已有 " : "收藏，已有 "}${nextCount} 人收藏`);
            const nEl = b.querySelector(".fav__n");
            if (nEl) nEl.textContent = String(nextCount);
            const tEl = b.querySelector(".fav__t");
            if (tEl) tEl.textContent = nextOn ? "已收藏" : "收藏";
            if (nextOn && !reducedMotion()) {
              b.classList.add("is-pop");
              const icWrap = b.querySelector(".fav__ic");
              if (icWrap && !icWrap.querySelector(".burst")) {
                const burst = document.createElement("span");
                burst.className = "burst";
                burst.innerHTML = Array.from({ length: 7 }, (_, k) =>
                  `<i style="--a:${Math.round((k * 360) / 7 - 90)}deg;--d:15px"></i>`
                ).join("");
                icWrap.appendChild(burst);
                setTimeout(() => { b.classList.remove("is-pop"); burst.remove(); }, 720);
              }
            }
          });
          if (!nextOn && typeof window.__htOnUnfavorite === "function") {
            window.__htOnUnfavorite(capsuleId);
          }
        } catch {
          toast("收藏没有成功，请稍后再试", { tone: "error" });
        } finally {
          allBtns.forEach((b) => delete b.dataset.busy);
        }
      })();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMenus();
  });

  /* ============================================================
   * 6. Hero 视差与实时时钟 / 列表卡片实时倒计时
   * ============================================================ */
  function initHeroEffects() {
    const paperHero = document.querySelector("[data-ht-paper-hero]");
    const paperArt = document.querySelector("[data-ht-paper-hero-art]");
    if (paperHero && paperArt) {
      paperHero.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch" || reducedMotion()) return;
        const r = paperHero.getBoundingClientRect();
        paperArt.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        paperArt.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
      paperHero.addEventListener("pointerleave", () => {
        paperArt.style.setProperty("--mx", "0");
        paperArt.style.setProperty("--my", "0");
      });
    }

    const amberHart = document.querySelector("[data-ht-amber-hart]");
    if (amberHart && !reducedMotion()) {
      let raf = 0;
      window.addEventListener("mousemove", (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = amberHart.getBoundingClientRect();
          if (!r.width) return;
          const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
          const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
          amberHart.style.setProperty("--tilt-x", `${(-dy * 14).toFixed(2)}deg`);
          amberHart.style.setProperty("--tilt-y", `${(dx * 16).toFixed(2)}deg`);
        });
      }, { passive: true });
    }

    const lunarText = fmt.lunar(Date.now());
    document.querySelectorAll("[data-ht-now-lunar]").forEach((el) => (el.textContent = lunarText));
  }
  initHeroEffects();

  function tickClocks() {
    const now = Date.now();
    document.querySelectorAll("[data-ht-now-cn]").forEach((el) => (el.textContent = `${fmt.cn(now)} ${fmt.week(now)}`));
    document.querySelectorAll("[data-ht-now-hms]").forEach((el) => (el.textContent = fmt.time(now, true)));
    document.querySelectorAll("[data-ht-now-dash]").forEach((el) => (el.textContent = `${fmt.dashDate(now)} ${fmt.time(now, true)}`));

    document.querySelectorAll("[data-ht-live-cd]").forEach((el) => {
      const iso = el.dataset.openAt;
      if (!iso) return;
      const openAt = new Date(iso).getTime();
      const c = fmt.cd(openAt, now);
      const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
      const mode = el.dataset.htLiveCd;
      if (mode === "paper") {
        el.innerHTML = c.d > 0
          ? `<b class="latin">${fmt.num(c.d)}</b><small>天</small><span class="mono">${hms}</span>`
          : `<b class="mono cap__cd-hms">${hms}</b>`;
      } else if (mode === "ledger-paper") {
        el.innerHTML = c.d > 0
          ? `<span class="latin">${fmt.num(c.d)}</span> 天`
          : `<span class="mono">${hms}</span>`;
      } else {
        el.textContent = c.d > 0 ? `${fmt.num(c.d)} 天 ${hms}` : hms;
      }
    });
  }
  setInterval(tickClocks, 1000);

  /* ============================================================
   * 7. 8 格输码（首页就地输码 & 开启页共用，双皮肤同步）
   * ============================================================ */
  function initCodeOpenForms() {
    const forms = Array.from(document.querySelectorAll("[data-ht-code-form]"));
    if (!forms.length) return;

    const clean = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    let value = "";
    let state = "idle"; // idle | checking | error | ok
    let errorMsg = "";
    let gen = 0;

    function syncViews(triggerShake = false) {
      forms.forEach((form) => {
        if (form.classList.contains("hquick")) {
          form.classList.toggle("is-full", value.length === 8);
        }

        const errEl = form.querySelector("[data-ht-code-err]");
        if (errEl) {
          errEl.textContent = errorMsg;
          setHook(errEl, errorMsg ? "open-error" : "");
        }

        const paperSubmit = form.querySelector("[data-ht-open-submit]");
        if (paperSubmit) {
          paperSubmit.disabled = value.length !== 8 || state === "checking";
          paperSubmit.classList.toggle("is-busy", state === "checking");
        }
        const amberSubmit = form.querySelector("[data-ht-amber-open-submit]");
        if (amberSubmit) {
          amberSubmit.classList.toggle("is-busy", state === "checking");
        }

        const paperBox = form.querySelector("[data-ht-paper-code]");
        if (paperBox) {
          paperBox.classList.toggle("is-error", state === "error");
          paperBox.classList.toggle("is-checking", state === "checking");
          paperBox.classList.toggle("is-ok", state === "ok");
          if (triggerShake) {
            paperBox.classList.remove("is-shake");
            void paperBox.offsetWidth;
            paperBox.classList.add("is-shake");
            setTimeout(() => paperBox.classList.remove("is-shake"), 480);
          }
          const cells = paperBox.querySelectorAll("input.code__cell");
          cells.forEach((cell, i) => {
            const ch = value[i] || "";
            if (cell.value !== ch) cell.value = ch;
            cell.dataset.value = ch;
            cell.classList.toggle("is-filled", !!ch);
          });
        }

        const amberBox = form.querySelector("[data-ht-amber-code]");
        if (amberBox) {
          amberBox.classList.toggle("is-error", state === "error");
          amberBox.classList.toggle("is-checking", state === "checking");
          amberBox.classList.toggle("is-ok", state === "ok");
          if (triggerShake) {
            amberBox.classList.remove("is-shake");
            void amberBox.offsetWidth;
            amberBox.classList.add("is-shake");
            setTimeout(() => amberBox.classList.remove("is-shake"), 480);
          }
          const native = amberBox.querySelector("input.code__native");
          if (native && native.value !== value) native.value = value;
          const cells = amberBox.querySelectorAll(".code__cell");
          const activeIdx = Math.min(value.length, 7);
          cells.forEach((cell, i) => {
            const ch = value[i] || "";
            cell.textContent = ch;
            cell.dataset.value = ch;
            cell.classList.toggle("is-filled", !!ch);
            cell.classList.toggle("is-active", i === activeIdx);
          });
        }
      });
    }

    async function go(raw) {
      const c = clean(raw);
      value = c;
      const my = ++gen;
      if (c.length !== 8) {
        state = "error";
        errorMsg = "胶囊码是 8 位大写字母与数字";
        syncViews(true);
        return;
      }
      state = "checking";
      errorMsg = "";
      syncViews(false);

      try {
        const waitMs = reducedMotion() ? 0 : 320;
        const [detail] = await Promise.all([apiFetch(`/api/v1/capsules/${c}`), sleep(waitMs)]);
        if (my !== gen) return;
        state = "ok";
        syncViews(false);
        await sleep(reducedMotion() ? 0 : 180);
        if (my !== gen) return;
        window.location.href = `/capsules/${detail.code}`;
      } catch (err) {
        if (my !== gen) return;
        state = "error";
        errorMsg = err instanceof ApiError && err.status === 404
          ? "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1"
          : "查询失败，请稍后再试";
        syncViews(true);
      }
    }

    function updateValue(next, autoSubmit = true) {
      gen++;
      value = clean(next);
      if (state === "error" || state === "ok") {
        state = "idle";
        errorMsg = "";
      }
      syncViews(false);
      if (autoSubmit && value.length === 8) {
        void go(value);
      }
    }

    forms.forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        void go(value);
      });

      const pasteBtn = form.querySelector("[data-ht-code-paste]");
      if (pasteBtn) {
        pasteBtn.addEventListener("click", async () => {
          try {
            const t = clean(await navigator.clipboard.readText());
            if (!t) return toast("剪贴板里没有胶囊码", { tone: "info" });
            updateValue(t, true);
          } catch {
            toast("粘贴失败：请允许浏览器访问剪贴板", { tone: "error" });
          }
        });
      }

      // 时笺 8 个输入框
      const paperBox = form.querySelector("[data-ht-paper-code]");
      if (paperBox) {
        const cells = Array.from(paperBox.querySelectorAll("input.code__cell"));
        cells.forEach((cell, idx) => {
          cell.addEventListener("input", (e) => {
            if (e.isComposing) return;
            const raw = clean(cell.value);
            if (raw.length >= 8) {
              updateValue(raw.slice(0, 8), true);
              cells[7]?.focus();
              return;
            }
            if (raw.length > 1) {
              const arr = Array.from({ length: 8 }, (_, k) => value[k] || "");
              for (let k = 0; k < raw.length && idx + k < 8; k++) arr[idx + k] = raw[k];
              const merged = arr.join("");
              const focusIdx = Math.min(idx + raw.length, 7);
              updateValue(merged, true);
              cells[focusIdx]?.focus();
              return;
            }
            const arr = Array.from({ length: 8 }, (_, k) => value[k] || "");
            arr[idx] = raw;
            // 收拢前导非空字符，保持紧凑输入体验
            const merged = arr.join("");
            updateValue(merged, true);
            if (raw && idx < 7) cells[idx + 1]?.focus();
          });

          cell.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasted = clean(e.clipboardData?.getData("text") || "");
            if (!pasted) return;
            if (pasted.length >= 8 || idx === 0) {
              updateValue(pasted.slice(0, 8), true);
              cells[Math.min(pasted.length, 7)]?.focus();
            } else {
              const next = (value.slice(0, idx) + pasted).slice(0, 8);
              updateValue(next, true);
              cells[Math.min(next.length, 7)]?.focus();
            }
          });

          cell.addEventListener("keydown", (e) => {
            if (e.key === "Backspace") {
              if (value[idx]) {
                e.preventDefault();
                const next = value.slice(0, idx) + value.slice(idx + 1);
                updateValue(next, false);
              } else if (idx > 0) {
                e.preventDefault();
                const next = value.slice(0, idx - 1) + value.slice(idx);
                updateValue(next, false);
                cells[idx - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft" && idx > 0) {
              e.preventDefault();
              cells[idx - 1]?.focus();
            } else if (e.key === "ArrowRight" && idx < 7) {
              e.preventDefault();
              cells[idx + 1]?.focus();
            } else if (e.key === "Enter") {
              e.preventDefault();
              void go(value);
            }
          });
        });
      }

      // 琥珀单原生输入框（严格处理一次填入 8 位整码覆盖旧半截码，见升级指南 §2.7）
      const amberBox = form.querySelector("[data-ht-amber-code]");
      if (amberBox) {
        const native = amberBox.querySelector("input.code__native");
        amberBox.addEventListener("click", () => native?.focus());
        native?.addEventListener("focus", () => amberBox.classList.add("is-focused"));
        native?.addEventListener("blur", () => amberBox.classList.remove("is-focused"));
        native?.addEventListener("input", (e) => {
          if (e.isComposing) return;
          const chunk = clean(e.data ?? "");
          const next = chunk.length === 8 ? chunk : clean(native.value);
          updateValue(next, true);
        });
        native?.addEventListener("compositionend", () => {
          updateValue(clean(native.value), true);
        });
        native?.addEventListener("paste", (e) => {
          e.preventDefault();
          const pasted = clean(e.clipboardData?.getData("text") || "");
          if (!pasted) return;
          updateValue(pasted.length >= 8 ? pasted.slice(0, 8) : clean(value + pasted), true);
        });
      }

      if (form.dataset.autofocus === "true") {
        setTimeout(() => {
          if (!isElementActiveForSkin(form, currentSkin())) return;
          const inp = form.querySelector('[data-testid="code-input"]');
          focusIfIdle(inp);
        }, 320);
      }
    });

    window.addEventListener("pagehide", () => { gen++; });
    syncViews(false);
  }
  initCodeOpenForms();

  /* ============================================================
   * 8. 首页广场（HTMX 局部片段替换 + 跨皮肤防抖搜索 + 错误重试）
   * ============================================================ */
  function initPlaza() {
    const plazaRoot = document.querySelector("[data-ht-plaza-root]");
    if (!plazaRoot) return;

    const state = {
      sort: plazaRoot.dataset.initSort || "new",
      filter: plazaRoot.dataset.initFilter || "all",
      qInput: plazaRoot.dataset.initQ || "",
      qApplied: plazaRoot.dataset.initQ || "",
      page: parseInt(plazaRoot.dataset.initPage, 10) || 1,
    };
    let debounceTimer = 0;

    function clampCodePoints(str, max) {
      const cps = Array.from(str);
      return cps.length <= max ? str : cps.slice(0, max).join("");
    }

    function syncToolbarUi(animateSeg = true) {
      plazaRoot.querySelectorAll("[data-ht-plaza-search]").forEach((inp) => {
        if (inp.value !== state.qInput) inp.value = state.qInput;
      });
      plazaRoot.querySelectorAll("[data-ht-search-wrap]").forEach((w) => {
        w.classList.toggle("has-value", state.qInput.length > 0);
      });
      plazaRoot.querySelectorAll("[data-ht-plaza-sort]").forEach((btn) => {
        const on = btn.dataset.htPlazaSort === state.sort;
        btn.classList.toggle("is-active", on);
        btn.dataset.selected = String(on);
        btn.setAttribute("aria-pressed", String(on));
      });
      plazaRoot.querySelectorAll("[data-ht-plaza-select]").forEach((sel) => {
        if (sel.value !== state.sort) sel.value = state.sort;
      });
      plazaRoot.querySelectorAll("[data-ht-plaza-filter]").forEach((btn) => {
        const on = btn.dataset.htPlazaFilter === state.filter;
        btn.classList.toggle("is-active", on);
        btn.dataset.selected = String(on);
        btn.setAttribute("aria-pressed", String(on));
      });
      placeAllIndicators(animateSeg);
    }

    function updateFilterCounts(all, unopened, opened) {
      const map = { all, unopened, opened };
      plazaRoot.querySelectorAll("[data-ht-plaza-filter]").forEach((btn) => {
        const k = btn.dataset.htPlazaFilter;
        if (map[k] == null) return;
        btn.dataset.count = String(map[k]);
        let sup = btn.querySelector("sup");
        if (!sup) {
          sup = document.createElement("sup");
          btn.appendChild(sup);
        }
        sup.textContent = String(map[k]);
      });
      placeAllIndicators(false);
    }

    function fetchGrid() {
      const params = new URLSearchParams({
        sort: state.sort,
        filter: state.filter,
        page: String(state.page),
      });
      if (state.qApplied.trim()) params.set("q", state.qApplied.trim());
      const resultsEl = document.getElementById("plaza-results");
      resultsEl?.querySelectorAll("[data-ht-plaza-grid]").forEach((g) => g.classList.add("is-busy"));

      if (window.htmx) {
        window.htmx.ajax("GET", `/ui/plaza/grid?${params.toString()}`, {
          target: "#plaza-results",
          swap: "innerHTML",
        });
      }
    }

    function renderErrorFallback() {
      const resultsEl = document.getElementById("plaza-results");
      const tpl = document.getElementById("ht-plaza-error-tpl");
      if (!resultsEl || !tpl) return;
      resultsEl.innerHTML = "";
      resultsEl.appendChild(tpl.content.cloneNode(true));
      syncSkinDom(resultsEl);
    }

    document.body.addEventListener("htmx:afterSwap", (e) => {
      const target = e.detail?.target;
      if (!target) return;
      if (target.id === "plaza-results") {
        syncSkinDom(target);
        const meta = target.querySelector(".plaza-results-meta");
        if (meta) {
          updateFilterCounts(meta.dataset.countAll, meta.dataset.countUnopened, meta.dataset.countOpened);
        }
      } else if (target.id === "plaza-overview") {
        syncSkinDom(target);
      }
    });

    const onHtmxErr = (e) => {
      if (e.detail?.target?.id === "plaza-results") {
        renderErrorFallback();
      }
    };
    document.body.addEventListener("htmx:responseError", onHtmxErr);
    document.body.addEventListener("htmx:sendError", onHtmxErr);

    plazaRoot.querySelectorAll("[data-ht-plaza-search]").forEach((inp) => {
      const handleInput = () => {
        const clamped = clampCodePoints(inp.value, 50);
        if (inp.value !== clamped) inp.value = clamped;
        state.qInput = clamped;
        syncToolbarUi(false);
        clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
          state.qApplied = state.qInput;
          state.page = 1;
          fetchGrid();
        }, 280);
      };
      inp.addEventListener("input", (e) => {
        if (e.isComposing) return;
        handleInput();
      });
      inp.addEventListener("compositionend", handleInput);
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          clearTimeout(debounceTimer);
          state.qInput = "";
          state.qApplied = "";
          state.page = 1;
          syncToolbarUi(false);
          inp.blur();
          fetchGrid();
        }
      });
    });

    plazaRoot.addEventListener("click", (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;

      const sortBtn = t.closest("[data-ht-plaza-sort]");
      if (sortBtn) {
        const next = sortBtn.dataset.htPlazaSort;
        if (next && next !== state.sort) {
          state.sort = next;
          state.page = 1;
          syncToolbarUi(true);
          fetchGrid();
        }
        return;
      }

      const filterBtn = t.closest("[data-ht-plaza-filter]");
      if (filterBtn) {
        const next = filterBtn.dataset.htPlazaFilter;
        if (next && next !== state.filter) {
          state.filter = next;
          state.page = 1;
          syncToolbarUi(true);
          fetchGrid();
        }
        return;
      }

      if (t.closest("[data-ht-plaza-clear]")) {
        clearTimeout(debounceTimer);
        state.qInput = "";
        state.qApplied = "";
        state.page = 1;
        syncToolbarUi(false);
        fetchGrid();
        return;
      }

      const pageBtn = t.closest("[data-ht-plaza-page]");
      if (pageBtn && !pageBtn.disabled) {
        const nextP = parseInt(pageBtn.dataset.htPlazaPage, 10);
        if (nextP && nextP !== state.page) {
          state.page = nextP;
          fetchGrid();
          document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        }
        return;
      }

      if (t.closest("[data-ht-plaza-retry]")) {
        fetchGrid();
      }
    });

    plazaRoot.querySelectorAll("[data-ht-plaza-select]").forEach((sel) => {
      sel.addEventListener("change", () => {
        state.sort = sel.value === "hot" ? "hot" : "new";
        state.page = 1;
        syncToolbarUi(true);
        fetchGrid();
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const inp = plazaRoot.querySelector('[data-testid="plaza-search"]');
      if (inp) {
        e.preventDefault();
        inp.focus();
      }
    });

    // 实时到点检查：若有封存卡片到期，自动刷新列表与概览
    let refreshingExpired = false;
    setInterval(() => {
      if (refreshingExpired) return;
      const now = Date.now();
      const cards = plazaRoot.querySelectorAll('article[data-state="sealed"][data-open-at]');
      for (const card of cards) {
        if (new Date(card.dataset.openAt).getTime() <= now) {
          refreshingExpired = true;
          fetchGrid();
          if (window.htmx) {
            window.htmx.ajax("GET", "/ui/plaza/overview", { target: "#plaza-overview", swap: "outerHTML" });
          }
          setTimeout(() => { refreshingExpired = false; }, 3000);
          break;
        }
      }
    }, 1000);
  }
  initPlaza();

  /* ============================================================
   * 9. 胶囊详情页（倒计时翻牌 + 归零动画 + 退避轮询确认 isOpened）
   * ============================================================ */
  function initCapsuleDetail() {
    const detailRoot = document.querySelector("[data-ht-detail-root]");
    if (!detailRoot) return;
    if (detailRoot.dataset.isOpened === "true" || !detailRoot.dataset.openAt) return;

    const code = detailRoot.dataset.code;
    const openAtMs = new Date(detailRoot.dataset.openAt).getTime();
    const paperHost = detailRoot.querySelector("[data-ht-detail-paper]");
    const amberHost = detailRoot.querySelector("[data-ht-detail-amber]");
    const abortCtrl = new AbortController();
    window.addEventListener("pagehide", () => abortCtrl.abort());

    function updateFlipDigits(unitEl, str) {
      if (!unitEl) return;
      const chars = Array.from(str);
      const existing = Array.from(unitEl.querySelectorAll(".dg"));
      if (existing.length !== chars.length) {
        unitEl.innerHTML = chars.map((ch) => `<span class="dg" data-v="${ch}"><span class="dg__cur">${ch}</span></span>`).join("");
        return;
      }
      existing.forEach((dg, i) => {
        const prev = dg.dataset.v;
        const next = chars[i];
        if (prev === next) return;
        dg.dataset.v = next;
        dg.innerHTML = `<span class="dg__out">${prev}</span><span class="dg__cur dg__in">${next}</span>`;
        setTimeout(() => {
          if (dg.dataset.v === next) dg.innerHTML = `<span class="dg__cur">${next}</span>`;
        }, 520);
      });
    }

    function updateAmberDigits(unitEl, str) {
      if (!unitEl) return;
      const chars = Array.from(str);
      const existing = Array.from(unitEl.querySelectorAll(".cd__digit"));
      if (existing.length !== chars.length) {
        unitEl.innerHTML = chars.map((ch) => `<span class="cd__digit">${ch}</span>`).join("");
        return;
      }
      existing.forEach((span, i) => {
        if (span.textContent !== chars[i]) {
          const fresh = document.createElement("span");
          fresh.className = "cd__digit";
          fresh.textContent = chars[i];
          span.replaceWith(fresh);
        }
      });
    }

    let openingStarted = false;

    async function awaitOpenedHtml(signal) {
      for (let i = 0; !signal.aborted; i++) {
        try {
          const res = await fetch(`/ui/capsules/${encodeURIComponent(code)}/opened`, {
            signal,
            credentials: "same-origin",
          });
          if (signal.aborted) return null;
          if (res.status === 200) {
            return await res.text();
          }
          if (res.status === 404) {
            window.location.reload();
            return null;
          }
        } catch {
          if (signal.aborted) return null;
        }
        await sleep(Math.min(1000 * (i + 1), 5000));
      }
      return null;
    }

    async function runOpeningSequence() {
      if (openingStarted) return;
      openingStarted = true;
      const { signal } = abortCtrl;

      const labelEl = paperHost?.querySelector("[data-ht-cd-label]");
      if (labelEl) labelEl.textContent = "时间到了，正在启封…";

      const amberOpening = amberHost?.querySelector("[data-ht-amber-opening]");
      const amberContent = amberHost?.querySelector("[data-ht-amber-content]");

      if (!reducedMotion()) {
        // 时笺动画：火漆裂成两半 → 掀开封舌 → 信纸升起
        if (paperHost) {
          paperHost.classList.add("is-opening");
          const env = paperHost.querySelector("[data-ht-envelope]");
          const seal = paperHost.querySelector("[data-ht-env-seal]");
          const whole = paperHost.querySelector("[data-ht-wax-whole]");
          const halfL = paperHost.querySelector("[data-ht-wax-l]");
          const halfR = paperHost.querySelector("[data-ht-wax-r]");
          if (whole && halfL && halfR) {
            whole.hidden = true;
            halfL.hidden = false;
            halfR.hidden = false;
          }
          if (amberOpening && amberContent) {
            setSubtreeUnhooked(amberContent, true);
            amberOpening.hidden = false;
          }
          await sleep(60);
          if (signal.aborted) return;
          seal?.classList.add("is-cracked");
          await sleep(620);
          if (signal.aborted) return;
          env?.classList.add("is-open");
          if (amberOpening) {
            amberOpening.classList.add("is-open");
            const cart = amberOpening.querySelector("[data-ht-cart]");
            cart?.classList.remove("cart--locked");
            cart?.classList.add("cart--opened");
          }
          await sleep(760);
          if (signal.aborted) return;
          env?.classList.add("is-rising");
          await sleep(900);
          if (signal.aborted) return;
          paperHost.classList.add("is-leaving");
          await sleep(380);
          if (signal.aborted) return;
        }
      }

      const html = await awaitOpenedHtml(signal);
      if (!html || signal.aborted) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const paperOpened = doc.querySelector('[data-opened-skin="paper"]');
      const amberOpened = doc.querySelector('[data-opened-skin="amber"]');

      if (paperHost && paperOpened) {
        paperHost.classList.remove("is-opening", "is-leaving");
        paperHost.dataset.state = "opened";
        paperHost.innerHTML = paperOpened.innerHTML;
      }
      if (amberHost && amberOpened) {
        amberHost.dataset.state = "opened";
        if (amberOpening) amberOpening.hidden = true;
        if (amberContent) {
          amberContent.innerHTML = amberOpened.innerHTML;
          setSubtreeUnhooked(amberContent, false);
        }
      }
      detailRoot.dataset.isOpened = "true";
      syncSkinDom(detailRoot);
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      toast(currentSkin() === "paper" ? "胶囊已启封" : "胶囊已开启");
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const c = fmt.cd(openAtMs, now);
      const dStr = c.d > 99 ? String(c.d) : pad2(c.d);
      const hStr = pad2(c.h);
      const mStr = pad2(c.m);
      const sStr = pad2(c.s);

      if (paperHost) {
        updateFlipDigits(paperHost.querySelector('[data-ht-cd-unit="d"]'), dStr);
        updateFlipDigits(paperHost.querySelector('[data-ht-cd-unit="h"]'), hStr);
        updateFlipDigits(paperHost.querySelector('[data-ht-cd-unit="m"]'), mStr);
        updateFlipDigits(paperHost.querySelector('[data-ht-cd-unit="s"]'), sStr);
        const journey = paperHost.querySelector(".journey");
        if (journey?.dataset.createdAt) {
          const pct = fmt.progress(new Date(journey.dataset.createdAt).getTime(), openAtMs, now);
          const pctEl = journey.querySelector("[data-ht-journey-pct]");
          const scaleEl = journey.querySelector("[data-ht-scale]");
          if (pctEl) pctEl.textContent = `已等待 ${pct}%`;
          if (scaleEl) scaleEl.style.setProperty("--p", `${pct}%`);
        }
      }

      if (amberHost) {
        updateAmberDigits(amberHost.querySelector('[data-ht-amber-cd-unit="d"]'), String(c.d).padStart(2, "0"));
        updateAmberDigits(amberHost.querySelector('[data-ht-amber-cd-unit="h"]'), hStr);
        updateAmberDigits(amberHost.querySelector('[data-ht-amber-cd-unit="m"]'), mStr);
        updateAmberDigits(amberHost.querySelector('[data-ht-amber-cd-unit="s"]'), sStr);
        const vault = amberHost.querySelector(".vault");
        if (vault?.dataset.createdAt) {
          const createdMs = new Date(vault.dataset.createdAt).getTime();
          const pct = clamp(((now - createdMs) / Math.max(1, openAtMs - createdMs)) * 100, 0, 100);
          const ringC = 2 * Math.PI * 150;
          const arc = vault.querySelector("[data-ht-vault-arc]");
          const pctText = vault.querySelector("[data-ht-vault-pct]");
          if (arc) arc.style.strokeDasharray = `${((ringC * pct) / 100).toFixed(1)} ${ringC.toFixed(1)}`;
          if (pctText) pctText.textContent = `${pct.toFixed(2)}%`;
        }
      }

      if (c.expired) {
        clearInterval(timer);
        void runOpeningSequence();
      }
    }, 1000);

    if (openAtMs <= Date.now()) {
      clearInterval(timer);
      void runOpeningSequence();
    }
  }
  initCapsuleDetail();

  /* ============================================================
   * 10. 表单共享工具（登录 / 注册 / 个人中心）
   * ============================================================ */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NICK_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
  const pwdRules = (v) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
  const pwdValid = (v) => { const r = pwdRules(v); return r.len && r.alpha && r.digit; };

  function safeRedirect(next, fallback) {
    if (!next || typeof next !== "string") return fallback;
    if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
    return next;
  }

  function setFieldError(scope, fieldName, msg) {
    scope.querySelectorAll(`[data-ht-field="${fieldName}"]`).forEach((f) => {
      f.classList.toggle("is-error", !!msg);
      const hint = f.querySelector(`[data-ht-hint="${fieldName}"]`);
      if (hint) {
        hint.textContent = msg || hint.dataset.defaultHint || "";
        if (msg) {
          hint.dataset.field = fieldName;
          setHook(hint, "field-error");
        } else {
          setHook(hint, "");
        }
      }
      if (msg) {
        const box = f.querySelector("[data-ht-field-box]");
        if (box) {
          box.classList.remove("is-shake");
          void box.offsetWidth;
          box.classList.add("is-shake");
          setTimeout(() => box.classList.remove("is-shake"), 480);
        }
      }
    });
  }

  function updateNickIndicator(scope, rawNick, forcedState, defaultHint) {
    const trimmed = String(rawNick || "").trim();
    let state = "";
    let hintText = defaultHint || "";
    if (forcedState) {
      state = forcedState.state;
      hintText = forcedState.hint || hintText;
    } else if (trimmed) {
      if (Array.from(trimmed).length < 2) {
        state = "";
        hintText = "至少 2 个字符";
      } else if (!NICK_RE.test(trimmed)) {
        state = "invalid";
        hintText = "只能用字母、数字、下划线和连字符";
      } else {
        state = "valid";
      }
    }

    scope.querySelectorAll("[data-ht-nick-state]").forEach((el) => {
      const good = state === "valid";
      const bad = state === "invalid" || state === "taken";
      el.classList.toggle("is-good", good);
      el.classList.toggle("is-bad", bad);
      el.innerHTML = good ? iconSvg("check") : bad ? iconSvg("x") : "";
      if (state) {
        el.dataset.state = state;
        setHook(el, "nickname-state");
      } else {
        delete el.dataset.state;
        setHook(el, "");
      }
    });

    scope.querySelectorAll('[data-ht-field="nickname"]').forEach((f) => {
      const isErr = state === "invalid" || state === "taken";
      f.classList.toggle("is-error", isErr);
      const hint = f.querySelector('[data-ht-hint="nickname"]');
      if (hint) {
        hint.textContent = hintText;
        if (isErr) {
          hint.dataset.field = "nickname";
          setHook(hint, "field-error");
        } else {
          setHook(hint, "");
        }
      }
    });
  }

  function updatePwdRulesUi(scope, pwd) {
    const r = pwdRules(pwd || "");
    scope.querySelectorAll("[data-ht-pwd-rules]").forEach((ul) => {
      ul.querySelector('[data-rule="len"]')?.classList.toggle("is-ok", r.len);
      ul.querySelector('[data-rule="alpha"]')?.classList.toggle("is-ok", r.alpha);
      ul.querySelector('[data-rule="digit"]')?.classList.toggle("is-ok", r.digit);
    });
  }

  function bindSyncedInputs(scope, onFieldChange) {
    scope.querySelectorAll("input[data-ht-sync]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const key = inp.dataset.htSync;
        const val = inp.value;
        scope.querySelectorAll(`input[data-ht-sync="${key}"]`).forEach((other) => {
          if (other !== inp && other.value !== val) other.value = val;
        });
        onFieldChange?.(key, val);
      });
    });
  }

  function bindAvatarPickers(scope, initialId, onSelect) {
    let selected = initialId || "neo";
    const ids = avatarList.map((a) => a.id);

    function applyAvatar(id) {
      selected = id;
      const meta = avatarOf(id);
      scope.querySelectorAll("[data-ht-avpick]").forEach((box) => {
        box.querySelectorAll('[data-ht-testid="avatar-option"], [data-testid="avatar-option"]').forEach((btn) => {
          const on = btn.dataset.value === id;
          btn.classList.toggle("is-sel", on);
          btn.setAttribute("aria-checked", String(on));
          btn.dataset.selected = String(on);
          btn.tabIndex = on ? 0 : -1;
        });
      });
      scope.querySelectorAll("[data-ht-avpick-cap]").forEach((cap) => {
        const nameEl = cap.querySelector("[data-ht-av-name]");
        const tagEl = cap.querySelector("[data-ht-av-tag]");
        const avEl = cap.querySelector("[data-ht-avatar]");
        if (nameEl) nameEl.textContent = meta.name;
        if (tagEl) tagEl.textContent = meta.tagline;
        if (avEl) {
          avEl.style.setProperty("--av", meta.primaryColor);
          const svg = avEl.querySelector("svg");
          if (svg) svg.innerHTML = meta.glyph;
        }
      });
      onSelect?.(id);
    }

    scope.querySelectorAll("[data-ht-avpick]").forEach((box) => {
      box.addEventListener("click", (e) => {
        const btn = e.target instanceof Element ? e.target.closest("[data-value]") : null;
        if (btn) applyAvatar(btn.dataset.value);
      });
      box.addEventListener("keydown", (e) => {
        let dir = 0;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") dir = 1;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") dir = -1;
        if (!dir || !ids.length) return;
        e.preventDefault();
        const curIdx = Math.max(0, ids.indexOf(selected));
        const nextId = ids[(curIdx + dir + ids.length) % ids.length];
        applyAvatar(nextId);
        requestAnimationFrame(() => box.querySelector(`[data-value="${nextId}"]`)?.focus());
      });
    });

    return { get: () => selected, set: applyAvatar };
  }

  function setBusyButtons(scope, selector, busy) {
    scope.querySelectorAll(selector).forEach((btn) => {
      btn.disabled = busy;
      btn.classList.toggle("is-busy", busy);
      const sp = btn.querySelector("[data-ht-submit-text]");
      if (sp) sp.textContent = busy ? sp.dataset.busy : sp.dataset.idle;
    });
  }

  /* ============================================================
   * 11. 登录页与注册页
   * ============================================================ */
  function initLogin() {
    const loginRoot = document.querySelector("[data-ht-login-root]");
    if (!loginRoot) return;
    const redirect = loginRoot.dataset.redirect || "";
    const state = { email: "", password: "" };

    function setFormErr(msg) {
      loginRoot.querySelectorAll("[data-ht-form-err]").forEach((el) => {
        el.textContent = msg || "";
        setHook(el, msg ? "login-error" : "");
      });
    }

    bindSyncedInputs(loginRoot, (key, val) => {
      state[key] = val;
      setFieldError(loginRoot, key, "");
      setFormErr("");
    });

    loginRoot.querySelectorAll("[data-ht-login-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setFormErr("");
        if (!EMAIL_RE.test(state.email.trim())) {
          setFieldError(loginRoot, "email", "请输入有效的邮箱地址");
          return;
        }
        if (!state.password) {
          setFieldError(loginRoot, "password", "请输入密码");
          return;
        }
        setBusyButtons(loginRoot, "[data-ht-submit]", true);
        try {
          const t = await apiFetch("/api/v1/auth/login", {
            method: "POST",
            json: { email: state.email.trim(), password: state.password },
          });
          pushFlashToast(`欢迎回来，${t.user.nickname}`, "success");
          window.location.replace(redirect ? safeRedirect(redirect, "/") : "/me/created");
        } catch (err) {
          const msg = err instanceof ApiError && err.status === 401
            ? "邮箱或密码不正确"
            : err instanceof ApiError ? err.message : "网络异常，请稍后再试";
          setFormErr(msg);
          setBusyButtons(loginRoot, "[data-ht-submit]", false);
        }
      });
    });

    setTimeout(() => focusIfIdle(loginRoot.querySelector('[data-testid="login-email"]')), 320);
  }
  initLogin();

  function initRegister() {
    const regRoot = document.querySelector("[data-ht-register-root]");
    if (!regRoot) return;
    const redirect = regRoot.dataset.redirect || "";
    const state = { email: "", nickname: "", password: "" };
    const avPicker = bindAvatarPickers(regRoot, "neo");

    function setFormErr(msg) {
      regRoot.querySelectorAll("[data-ht-form-err]").forEach((el) => (el.textContent = msg || ""));
    }

    bindSyncedInputs(regRoot, (key, val) => {
      state[key] = val;
      setFormErr("");
      if (key === "nickname") {
        updateNickIndicator(regRoot, val, null, "全站唯一，注册后可以改。");
      } else {
        setFieldError(regRoot, key, "");
        if (key === "password") updatePwdRulesUi(regRoot, val);
      }
    });

    regRoot.querySelectorAll("[data-ht-register-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setFormErr("");
        if (!EMAIL_RE.test(state.email.trim())) {
          setFieldError(regRoot, "email", "请输入有效的邮箱地址");
          return;
        }
        if (!NICK_RE.test(state.nickname.trim())) {
          updateNickIndicator(regRoot, state.nickname, {
            state: "invalid",
            hint: "昵称需为 2–20 个字符：字母、数字、下划线或连字符",
          });
          return;
        }
        if (!pwdValid(state.password)) {
          setFieldError(regRoot, "password", "密码至少 8 位，且同时包含字母和数字");
          return;
        }

        const submittedNick = state.nickname;
        setBusyButtons(regRoot, "[data-ht-submit]", true);
        try {
          const t = await apiFetch("/api/v1/auth/register", {
            method: "POST",
            json: {
              email: state.email.trim(),
              nickname: state.nickname.trim(),
              password: state.password,
              avatarId: avPicker.get(),
            },
          });
          pushFlashToast(`你好，${t.user.nickname}`, "success");
          window.location.replace(redirect ? safeRedirect(redirect, "/") : "/create");
        } catch (err) {
          setBusyButtons(regRoot, "[data-ht-submit]", false);
          if (err instanceof ApiError) {
            const byField = {};
            (err.details || []).forEach((d) => (byField[d.field] = d.message));
            if (byField.email) setFieldError(regRoot, "email", byField.email);
            if (byField.password) setFieldError(regRoot, "password", byField.password);
            if (byField.nickname && state.nickname === submittedNick) {
              updateNickIndicator(regRoot, state.nickname, {
                state: err.status === 409 ? "taken" : "invalid",
                hint: byField.nickname,
              });
            }
            if (!Object.keys(byField).length) setFormErr(err.message);
          } else {
            setFormErr("网络异常，请稍后再试");
          }
        }
      });
    });

    setTimeout(() => focusIfIdle(regRoot.querySelector('[data-testid="register-email"]')), 320);
  }
  initRegister();

  /* ============================================================
   * 12. 个人中心（统计同步、删除确认、分页去重补齐、资料与密码）
   * ============================================================ */
  function initMe() {
    const meRoot = document.querySelector("[data-ht-me-root]");
    if (!meRoot) return;

    const tab = meRoot.dataset.tab;
    const pageSize = parseInt(meRoot.dataset.pageSize, 10) || 20;
    let total = parseInt(meRoot.dataset.total, 10) || 0;
    let moreBusy = false;

    async function refreshStats() {
      try {
        const s = await apiFetch("/api/v1/me/stats");
        ["created", "unopened", "favoritesReceived"].forEach((k) => {
          meRoot.querySelectorAll(`[data-ht-testid="me-stat"][data-key="${k}"], [data-testid="me-stat"][data-key="${k}"]`).forEach((el) => {
            el.dataset.value = String(s[k]);
          });
          meRoot.querySelectorAll(`[data-ht-stat-text="${k}"]`).forEach((dd) => {
            dd.textContent = fmt.num(s[k]);
          });
        });
        meRoot.querySelectorAll('[data-ht-testid="me-tab-created"], [data-testid="me-tab-created"]').forEach((a) => {
          a.dataset.count = String(s.created);
        });
        meRoot.querySelectorAll('[data-ht-tab-sup="created"]').forEach((sup) => (sup.textContent = String(s.created)));
        meRoot.querySelectorAll('[data-ht-testid="me-tab-favorites"], [data-testid="me-tab-favorites"]').forEach((a) => {
          a.dataset.count = String(s.favoritesGiven);
        });
        meRoot.querySelectorAll('[data-ht-tab-sup="favorites"]').forEach((sup) => (sup.textContent = String(s.favoritesGiven)));
        placeAllIndicators(false);
      } catch {}
    }

    function countShown() {
      const list = meRoot.querySelector('[data-ht-me-list="paper"]');
      return list ? list.children.length : 0;
    }

    function syncListFooter() {
      const shown = countShown();
      const prefix = tab === "created" ? "按创建时间倒序" : "按收藏时间倒序";
      meRoot.querySelectorAll("[data-ht-me-summary]").forEach((el) => {
        el.textContent = `${prefix} · 共 ${total} 枚`;
      });

      if (shown === 0 && total === 0) {
        ["paper", "amber"].forEach((sk) => {
          const view = meRoot.querySelector(`[data-skin-view="${sk}"]`);
          const nonempty = view?.querySelector("[data-ht-me-nonempty]");
          const tpl = view?.querySelector(`[data-ht-empty-tpl="${sk}"]`);
          if (nonempty && tpl) {
            const parent = nonempty.parentElement;
            nonempty.remove();
            parent.appendChild(tpl.content.cloneNode(true));
            syncSkinDom(view);
          }
        });
        return;
      }

      if (shown === 0 && total > 0) {
        void loadMoreRows(1);
        return;
      }

      const left = Math.max(0, total - shown);
      ["paper", "amber"].forEach((sk) => {
        const view = meRoot.querySelector(`[data-skin-view="${sk}"]`);
        const nonempty = view?.querySelector("[data-ht-me-nonempty]");
        if (!nonempty) return;
        let wrap = nonempty.querySelector("[data-ht-more-wrap]");
        if (left <= 0) {
          wrap?.remove();
        } else {
          if (!wrap) {
            wrap = document.createElement("div");
            wrap.className = "list-more";
            wrap.dataset.htMoreWrap = "";
            wrap.innerHTML = `<button class="btn btn--ghost" type="button" data-testid="list-next" data-ht-list-next="${tab}"></button>`;
            const fine = nonempty.querySelector(".me__fine, .tip");
            if (fine) nonempty.insertBefore(wrap, fine);
            else nonempty.appendChild(wrap);
            syncSkinDom(view);
          }
          const btn = wrap.querySelector("[data-ht-list-next]");
          if (btn) {
            btn.disabled = moreBusy;
            btn.classList.toggle("is-busy", moreBusy);
            btn.textContent = moreBusy ? "加载中…" : `加载更多（还有 ${left} 枚）`;
          }
        }
      });
    }

    async function loadMoreRows(forcedPage) {
      if (moreBusy) return;
      moreBusy = true;
      syncListFooter();
      const shown = countShown();
      const nextPage = forcedPage || Math.floor(shown / pageSize) + 1;
      try {
        const res = await fetch(`/ui/me/${tab}/rows?page=${nextPage}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("fetch_failed");
        const headerTotal = parseInt(res.headers.get("X-Total-Count") || "", 10);
        if (!Number.isNaN(headerTotal)) total = headerTotal;

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        ["paper", "amber"].forEach((sk) => {
          const list = meRoot.querySelector(`[data-ht-me-list="${sk}"]`);
          const batch = doc.querySelector(`[data-me-batch="${sk}"]`);
          if (!list || !batch) return;
          const existingIds = new Set(
            Array.from(list.children).map((el) => el.dataset.capsuleId).filter(Boolean)
          );
          Array.from(batch.children).forEach((row) => {
            if (!existingIds.has(row.dataset.capsuleId)) {
              list.appendChild(row);
            }
          });
        });
        syncSkinDom(meRoot);
      } catch {
        toast("加载失败，请稍后再试", { tone: "error" });
      } finally {
        moreBusy = false;
        syncListFooter();
      }
    }

    function dropItemById(capsuleId) {
      meRoot.querySelectorAll(`[data-ht-me-list] > [data-capsule-id="${capsuleId}"]`).forEach((el) => el.remove());
      total = Math.max(0, total - 1);
      syncListFooter();
      void refreshStats();
    }

    if (tab === "favorites") {
      window.__htOnUnfavorite = (capsuleId) => dropItemById(capsuleId);
    }

    meRoot.addEventListener("click", (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;

      const moreBtn = t.closest("[data-ht-list-next]");
      if (moreBtn) {
        void loadMoreRows();
        return;
      }

      const delBtn = t.closest("[data-delete-id]");
      if (delBtn) {
        const id = delBtn.dataset.deleteId;
        const code = delBtn.dataset.deleteCode;
        const title = delBtn.dataset.deleteTitle;
        const p = paletteOf(code);
        const amberArt = `<div class="dlg__art"><svg class="cart cart--opened" width="120" height="60" viewBox="0 0 240 120" style="--cap-glow:${p.glow}" aria-hidden="true"><defs><linearGradient id="dlgca1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.capLight}"/><stop offset="1" stop-color="${p.capDeep}"/></linearGradient><linearGradient id="dlgca2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".42"/></linearGradient></defs><ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6"/><g class="cart__paper"><rect x="98" y="24" width="44" height="62" rx="5"/><path d="M106 40h28M106 50h28M106 60h17"/></g><g class="cart__cap"><path d="M120 30H60a30 30 0 0 0 0 60h60Z" fill="url(#dlgca1)"/><path class="cart__groove" d="M104 31v58M111 31v58"/><path class="cart__shine" d="M60 41h36"/></g><g class="cart__body"><path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" fill="url(#dlgca2)"/><rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6"/><path class="cart__scroll-line" d="M141 56h30M141 64h19"/><path class="cart__shine" d="M132 40h40"/></g><rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5"/><circle class="cart__lock" cx="120" cy="60" r="4.5"/></svg></div>`;
        void (async () => {
          const ok = await confirmDialog({
            title: "删除这枚胶囊？",
            bodyHtml: `<p>《${escHtml(title)}》会被永久删除。持有胶囊码 <b class="mono">${escHtml(code)}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。</p><p class="dlg__warn">此操作不可恢复。</p>`,
            confirm: "删除",
            cancel: "再想想",
            tone: "danger",
            markPaper: '<div class="dlg__mark"><span class="seal seal--line" aria-hidden="true">删</span></div>',
            markAmber: amberArt,
          });
          if (!ok) return;
          try {
            await apiFetch(`/api/v1/me/capsules/${id}`, { method: "DELETE" });
            dropItemById(id);
            toast(`已删除《${title}》`);
          } catch (err) {
            toast(err instanceof ApiError ? err.message : "删除失败，请稍后再试", { tone: "error" });
          }
        })();
      }
    });

    // 账号设置页签逻辑
    if (tab === "profile") {
      let origNick = document.body.dataset.userNickname || "";
      let origAvatar = document.body.dataset.userAvatar || "neo";
      const profState = { nickname: origNick };
      const pwdState = { current: "", next: "", confirm: "" };
      const avPicker = bindAvatarPickers(meRoot, origAvatar, () => setProfMsg(null));

      function setProfMsg(m) {
        meRoot.querySelectorAll("[data-ht-prof-msg]").forEach((el) => {
          el.className = "form__msg" + (m ? ` is-${m.type}` : "");
          if (!m) { el.innerHTML = ""; return; }
          const ic = m.type === "err" ? "alert" : m.type === "ok" ? "check" : "info";
          el.innerHTML = `${iconSvg(ic)}<span>${escHtml(m.text)}</span>`;
        });
      }

      function setPwdMsg(m) {
        meRoot.querySelectorAll("[data-ht-pwd-msg]").forEach((el) => {
          el.className = "form__msg" + (m ? ` is-${m.type}` : "");
          if (!m) { el.innerHTML = ""; return; }
          const ic = m.type === "err" ? "alert" : "check";
          el.innerHTML = `${iconSvg(ic)}<span>${escHtml(m.text)}</span>`;
        });
      }

      bindSyncedInputs(meRoot, (key, val) => {
        if (key === "profile-nickname") {
          profState.nickname = val;
          setProfMsg(null);
          if (val.trim() === origNick) {
            updateNickIndicator(meRoot, "", null, "2–20 个字符，全站唯一。");
          } else {
            updateNickIndicator(meRoot, val, null, "2–20 个字符，全站唯一。");
          }
        } else if (key === "pwd-current") {
          pwdState.current = val;
          setFieldError(meRoot, "current", "");
          setPwdMsg(null);
        } else if (key === "pwd-new") {
          pwdState.next = val;
          setFieldError(meRoot, "new", "");
          updatePwdRulesUi(meRoot, val);
          setPwdMsg(null);
        } else if (key === "pwd-confirm") {
          pwdState.confirm = val;
          setFieldError(meRoot, "confirm", "");
          setPwdMsg(null);
        }
      });

      meRoot.querySelectorAll("[data-ht-prof-reset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          profState.nickname = origNick;
          meRoot.querySelectorAll('input[data-ht-sync="profile-nickname"]').forEach((inp) => (inp.value = origNick));
          avPicker.set(origAvatar);
          updateNickIndicator(meRoot, "", null, "2–20 个字符，全站唯一。");
          setProfMsg(null);
        });
      });

      meRoot.querySelectorAll("[data-ht-profile-form]").forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          setProfMsg(null);
          const patch = {};
          if (profState.nickname.trim() !== origNick) patch.nickname = profState.nickname.trim();
          if (avPicker.get() !== origAvatar) patch.avatarId = avPicker.get();

          if (!Object.keys(patch).length) {
            toast("没有需要保存的修改", { tone: "info" });
            setProfMsg({ type: "info", text: "没有改动" });
            return;
          }
          if (patch.nickname != null && !NICK_RE.test(patch.nickname)) {
            updateNickIndicator(meRoot, profState.nickname, {
              state: "invalid",
              hint: "昵称需为 2–20 个字符：字母、数字、下划线或连字符",
            });
            return;
          }

          const submittedNick = profState.nickname;
          setBusyButtons(meRoot, "[data-ht-prof-save]", true);
          try {
            const updated = await apiFetch("/api/v1/me", { method: "PATCH", json: patch });
            origNick = updated.nickname;
            origAvatar = updated.avatarId;
            document.body.dataset.userNickname = origNick;
            document.body.dataset.userAvatar = origAvatar;

            // 同步全页昵称、菜单 data-nickname 与头像徽记
            document.querySelectorAll("[data-ht-user-nick]").forEach((el) => (el.textContent = origNick));
            document.querySelectorAll("[data-ht-umenu-btn]").forEach((btn) => {
              btn.dataset.nickname = origNick;
              btn.setAttribute("aria-label", `${origNick} 的菜单`);
            });
            const avMeta = avatarOf(origAvatar);
            document.querySelectorAll("header [data-ht-avatar], .tabbar [data-ht-avatar], .me__head [data-ht-avatar]").forEach((el) => {
              el.style.setProperty("--av", avMeta.primaryColor);
              const svg = el.querySelector("svg");
              if (svg) svg.innerHTML = avMeta.glyph;
            });
            document.querySelectorAll(".me__head [data-ht-stamp]").forEach((st) => {
              st.style.setProperty("--av", avMeta.primaryColor);
              const svg = st.querySelector("svg");
              const b = st.querySelector("b");
              if (svg) svg.innerHTML = avMeta.glyph;
              if (b) b.textContent = avMeta.name;
            });
            updateNickIndicator(meRoot, "", null, "2–20 个字符，全站唯一。");
            setProfMsg({ type: "ok", text: "已保存" });
            toast("资料已更新");
          } catch (err) {
            if (err instanceof ApiError) {
              const byField = {};
              (err.details || []).forEach((d) => (byField[d.field] = d.message));
              if (byField.nickname && profState.nickname === submittedNick) {
                updateNickIndicator(meRoot, profState.nickname, {
                  state: err.status === 409 ? "taken" : "invalid",
                  hint: byField.nickname,
                });
              } else {
                setProfMsg({ type: "err", text: err.message });
              }
            } else {
              setProfMsg({ type: "err", text: "网络异常，请稍后再试" });
            }
          } finally {
            setBusyButtons(meRoot, "[data-ht-prof-save]", false);
          }
        });
      });

      meRoot.querySelectorAll("[data-ht-pwd-form]").forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          setPwdMsg(null);
          if (!pwdState.current) {
            setFieldError(meRoot, "current", "请输入当前密码");
            return;
          }
          if (!pwdValid(pwdState.next)) {
            setFieldError(meRoot, "new", "新密码至少 8 位，且同时包含字母和数字");
            return;
          }
          if (pwdState.next !== pwdState.confirm) {
            setFieldError(meRoot, "confirm", "两次输入的新密码不一致");
            return;
          }

          setBusyButtons(meRoot, "[data-ht-pwd-submit]", true);
          try {
            await apiFetch("/api/v1/me/password", {
              method: "POST",
              json: { currentPassword: pwdState.current, newPassword: pwdState.next },
            });
            pwdState.current = "";
            pwdState.next = "";
            pwdState.confirm = "";
            meRoot.querySelectorAll('input[data-ht-sync^="pwd-"]').forEach((inp) => (inp.value = ""));
            updatePwdRulesUi(meRoot, "");
            setPwdMsg({ type: "ok", text: "密码已更新。3 秒后将自动登出，请用新密码重新登录。" });
            setTimeout(() => {
              try { sessionStorage.removeItem("hellotime.draft"); } catch {}
              window.location.href = "/login";
            }, 3000);
          } catch (err) {
            setBusyButtons(meRoot, "[data-ht-pwd-submit]", false);
            setFieldError(meRoot, "current", err instanceof ApiError ? err.message : "修改失败，请稍后再试");
          }
        });
      });
    }
  }
  initMe();

  // 暴露公共接口给 create.js 使用
  window.HT = {
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
    copyText,
  };
})();
