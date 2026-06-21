/* ============================================================
 * HelloTime Pro · Spring MVC + Thymeleaf 全栈的渐进增强脚本
 *
 * SSR 负责整页与（经 HTMX）局部刷新；本文件只承载「天然属于浏览器」的交互：
 *   - 主题切换、用户菜单下拉
 *   - 头像选择器、8 位胶囊码输入、倒计时局部刷新
 *   - 创建页：快速预设 / 提交时本地时间→ISO / AI 灵感与生成
 *   - 资料页：保存改动（PATCH /api/v1/me）、改密前端校验
 *
 * AI 与资料相关交互直接调用同源 /api/v1 JSON 接口；浏览器带的 httpOnly cookie
 * 由服务端 CookieTokenFilter 注入成 Bearer 头完成鉴权。
 * ============================================================ */
(function () {
  "use strict";

  // ---------- 主题 ----------
  var THEME_KEY = "hellotime.theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* noop */ }
    var icon = document.querySelector(".cy-theme-toggle span");
    if (icon) icon.textContent = t === "dark" ? "☾" : "☀";
  }

  // ---------- 全局点击委托：主题、用户菜单 ----------
  document.addEventListener("click", function (e) {
    var toggle = e.target.closest(".cy-theme-toggle");
    if (toggle) {
      var cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      applyTheme(cur === "dark" ? "light" : "dark");
      return;
    }

    var chip = e.target.closest(".cy-user-chip--button");
    var menu = document.querySelector(".cy-user-menu");
    if (chip && menu) {
      var open = chip.getAttribute("aria-expanded") === "true";
      chip.setAttribute("aria-expanded", String(!open));
      var dd = menu.querySelector(".cy-user-dropdown");
      if (dd) dd.hidden = open;
      return;
    }
    if (menu && !e.target.closest(".cy-user-menu")) {
      var c = menu.querySelector(".cy-user-chip--button");
      var d = menu.querySelector(".cy-user-dropdown");
      if (c) c.setAttribute("aria-expanded", "false");
      if (d) d.hidden = true;
    }

    // 头像选择器（注册 / 资料页）
    var avatarBtn = e.target.closest(".cy-avatar-picker__item");
    if (avatarBtn) {
      var picker = avatarBtn.closest(".cy-avatar-picker");
      picker.querySelectorAll(".cy-avatar-picker__item").forEach(function (b) {
        b.classList.remove("is-selected");
        b.setAttribute("aria-checked", "false");
      });
      avatarBtn.classList.add("is-selected");
      avatarBtn.setAttribute("aria-checked", "true");
      var targetId = picker.getAttribute("data-target");
      if (targetId) {
        var hidden = document.getElementById(targetId);
        if (hidden) hidden.value = avatarBtn.getAttribute("data-avatar-id");
      }
    }

    // 收藏切换
    var fav = e.target.closest(".cy-capsule__fav");
    if (fav) {
      e.preventDefault();
      if (fav.getAttribute("data-anon") === "true") {
        if (window.confirm("登录后才能收藏，前往登录？")) {
          window.location.assign("/login?from=" + encodeURIComponent(window.location.pathname));
        }
        return;
      }
      if (fav.dataset.busy) return;
      fav.dataset.busy = "1";
      var capId = fav.getAttribute("data-capsule-id");
      // 同步请求：保证收藏在「点完立刻导航到 /me/favorites」之前已落库提交，
      // 消除 XHR 在途被导航中止 / 收藏未提交即被下一页查询读到的竞态。
      // 收藏是一次性的轻量写操作，主线程短暂阻塞可接受。
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/ui/capsules/" + capId + "/favorite-toggle", false);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.send();
        if (xhr.status >= 200 && xhr.status < 300) {
          var d = JSON.parse(xhr.responseText);
          fav.setAttribute("data-favorited", String(d.favorited));
          fav.classList.toggle("is-active", d.favorited);
          var ic = fav.querySelector(".cy-fav-icon");
          if (ic) ic.textContent = d.favorited ? "♥" : "♡";
          var ct = fav.querySelector(".cy-fav-count");
          if (ct) ct.textContent = d.favoriteCount;
        }
      } catch (err) {
        /* 静默 */
      } finally {
        delete fav.dataset.busy;
      }
    }
  });

  // ---------- 工具 ----------
  function isoToLocalInput(date) {
    var tz = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tz).toISOString().slice(0, 16);
  }
  function alertHtml(variant, text) {
    var icon = variant === "danger" ? "⚠" : variant === "success" ? "✓" : "ⓘ";
    return '<div class="cy-alert cy-alert--' + variant + '"><span>' + icon +
      "</span><span>" + text + "</span></div>";
  }
  function showMsg(el, variant, text) {
    if (el) el.innerHTML = alertHtml(variant, text);
  }

  // ---------- 倒计时 ----------
  var countdownTimer;
  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function countdownTo(rawOpenAt) {
    var target = new Date(rawOpenAt).getTime();
    var now = Date.now();
    if (isNaN(target)) {
      return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    var diff = Math.max(0, Math.floor((target - now) / 1000));
    return {
      expired: target <= now,
      days: Math.floor(diff / 86400),
      hours: Math.floor((diff % 86400) / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60
    };
  }
  function updateCountdown(el) {
    var cd = countdownTo(el.getAttribute("data-countdown-open-at"));
    if (el.getAttribute("data-countdown-inline") === "true") {
      el.textContent = "⏳ 还剩 " + cd.days.toLocaleString("zh-CN") + " 天 · " +
        pad2(cd.hours) + ":" + pad2(cd.minutes) + ":" + pad2(cd.seconds);
    }
    el.querySelectorAll("[data-countdown-unit]").forEach(function (unit) {
      var key = unit.getAttribute("data-countdown-unit");
      if (key === "days") unit.textContent = String(cd.days);
      if (key === "hours") unit.textContent = pad2(cd.hours);
      if (key === "minutes") unit.textContent = pad2(cd.minutes);
      if (key === "seconds") unit.textContent = pad2(cd.seconds);
    });
    if (cd.expired && el.getAttribute("data-countdown-reload") === "true" && !el.dataset.reloading) {
      el.dataset.reloading = "1";
      window.setTimeout(function () { window.location.reload(); }, 300);
    }
  }
  function tickCountdowns() {
    var nodes = document.querySelectorAll("[data-countdown-open-at]");
    nodes.forEach(updateCountdown);
    if (nodes.length === 0 && countdownTimer) {
      window.clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
  }
  function ensureCountdownTicker() {
    tickCountdowns();
    if (!countdownTimer && document.querySelector("[data-countdown-open-at]")) {
      countdownTimer = window.setInterval(tickCountdowns, 1000);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureCountdownTicker);
  } else {
    ensureCountdownTicker();
  }
  document.addEventListener("htmx:afterSwap", ensureCountdownTicker);

  // ---------- 8 位胶囊码输入（开启页）----------
  (function () {
    var wrap = document.querySelector(".cy-code-input");
    if (!wrap) return;
    var inputs = Array.prototype.slice.call(wrap.querySelectorAll("input"));
    function collect() { return inputs.map(function (i) { return i.value; }).join(""); }
    function maybeGo() {
      var code = collect();
      if (code.length === 8 && /^[A-Z0-9]{8}$/.test(code)) window.location.assign("/c/" + code);
    }
    inputs.forEach(function (inp, i) {
      inp.addEventListener("input", function () {
        inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 1);
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
        maybeGo();
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
        else if (e.key === "ArrowLeft" && i > 0) inputs[i - 1].focus();
        else if (e.key === "ArrowRight" && i < inputs.length - 1) inputs[i + 1].focus();
      });
      inp.addEventListener("paste", function (e) {
        e.preventDefault();
        var t = (e.clipboardData.getData("text") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        for (var k = 0; k < inputs.length; k++) inputs[k].value = t[k] || "";
        inputs[Math.min(t.length, inputs.length - 1)].focus();
        maybeGo();
      });
    });
    var openBtn = document.querySelector("[data-open-submit]");
    if (openBtn) openBtn.addEventListener("click", maybeGo);
  })();

  // ---------- 创建页日期时间选择器 ----------
  function localInputToDate(value) {
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    var fallback = new Date();
    fallback.setSeconds(0, 0);
    return fallback;
  }
  function toLocalValue(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) +
      "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }
  function formatPickerDisplay(date) {
    return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日 " +
      pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }
  function formatPickerDistance(date) {
    var diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);
    if (diffMinutes <= 0) return "已到开启时刻";
    if (diffMinutes < 60) return "距开启 " + diffMinutes + " 分钟";
    var hours = Math.floor(diffMinutes / 60);
    var minutes = diffMinutes % 60;
    if (hours < 24) return "距开启 " + hours + " 小时" + (minutes ? " " + minutes + " 分钟" : "");
    var days = Math.floor(hours / 24);
    var restHours = hours % 24;
    if (days < 365) return "距开启 " + days + " 天" + (restHours ? " " + restHours + " 小时" : "");
    var years = Math.floor(days / 365);
    var restDays = days % 365;
    return "距开启 " + years + " 年" + (restDays ? " " + restDays + " 天" : "");
  }
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
  function firstWeekdayFromMonday(year, month) {
    return (new Date(year, month, 1).getDay() + 6) % 7;
  }
  function pickerPresetDate(spec) {
    var next = new Date();
    next.setSeconds(0, 0);
    switch (spec) {
      case "1m": next.setMinutes(next.getMinutes() + 2); return next;
      case "1h": next.setHours(next.getHours() + 1); return next;
      case "tomorrow9": next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0); return next;
      case "1y": next.setFullYear(next.getFullYear() + 1); return next;
      case "y2030": return new Date(2030, 0, 1, 0, 0, 0, 0);
      default: return next;
    }
  }
  function initDateTimePicker(root, input) {
    if (!root || !input || root.dataset.ready) return null;
    root.dataset.ready = "1";
    var open = false;
    var placement = "below";
    var maxHeight = 460;
    var draft = localInputToDate(input.value);
    var viewMonth = new Date(draft.getFullYear(), draft.getMonth(), 1);

    function manualParts() {
      return {
        year: String(draft.getFullYear()),
        month: pad2(draft.getMonth() + 1),
        day: pad2(draft.getDate()),
        hour: pad2(draft.getHours()),
        minute: pad2(draft.getMinutes())
      };
    }
    function syncFromInput() {
      draft = localInputToDate(input.value);
      viewMonth = new Date(draft.getFullYear(), draft.getMonth(), 1);
      render();
    }
    function commitDraft(next) {
      draft = next;
      viewMonth = new Date(next.getFullYear(), next.getMonth(), 1);
      render();
    }
    function updatePlacement() {
      var popover = root.querySelector(".cy-dtp__popover");
      if (!popover) return;
      var gap = 8;
      var rect = root.getBoundingClientRect();
      var spaceBelow = window.innerHeight - rect.bottom - gap;
      var spaceAbove = rect.top - gap;
      var popoverHeight = popover.offsetHeight;
      placement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "above" : "below";
      maxHeight = Math.max(160, Math.min(460, Math.floor(placement === "above" ? spaceAbove : spaceBelow)));
      popover.classList.toggle("cy-dtp__popover--above", placement === "above");
      popover.classList.toggle("cy-dtp__popover--below", placement === "below");
      popover.style.setProperty("--cy-dtp-max-height", maxHeight + "px");
    }
    function render() {
      var year = viewMonth.getFullYear();
      var month = viewMonth.getMonth();
      var parts = manualParts();
      var html = '<button id="' + input.id + '_trigger" type="button" class="cy-dtp__trigger" aria-haspopup="dialog" aria-expanded="' + open + '">'
        + '<span class="cy-dtp__trigger-icon" aria-hidden="true">⏱</span><span class="cy-dtp__trigger-main"><span class="cy-dtp__trigger-value">'
        + formatPickerDisplay(localInputToDate(input.value)) + '<span class="cy-dtp__trigger-hint">' + formatPickerDistance(localInputToDate(input.value)) + '</span>'
        + '</span></span><span class="cy-dtp__trigger-chevron" aria-hidden="true">⌄</span></button>';
      if (open) {
        html += '<div class="cy-dtp__popover cy-dtp__popover--' + placement + '" style="--cy-dtp-max-height:' + maxHeight + 'px" role="dialog" aria-labelledby="' + input.id + '_title">'
          + '<div class="cy-dtp__topbar"><div class="cy-dtp__summary"><span id="' + input.id + '_title" class="cy-dtp__eyebrow">选择开启时刻</span><strong>' + formatPickerDistance(draft) + '</strong></div>'
          + '<div class="cy-dtp__manual" aria-label="手动输入开启时间">'
          + '<input aria-label="年份" inputmode="numeric" data-part="year" value="' + parts.year + '"><span>年</span>'
          + '<input aria-label="月份" inputmode="numeric" data-part="month" value="' + parts.month + '"><span>月</span>'
          + '<input aria-label="日期" inputmode="numeric" data-part="day" value="' + parts.day + '"><span>日</span>'
          + '<input aria-label="小时" inputmode="numeric" data-part="hour" value="' + parts.hour + '"><span>:</span>'
          + '<input aria-label="分钟" inputmode="numeric" data-part="minute" value="' + parts.minute + '"></div>'
          + '<div class="cy-dtp__actions"><button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-dtp-cancel>取消</button><button type="button" class="cy-btn cy-btn--primary cy-btn--sm" data-dtp-confirm>确认</button></div></div>'
          + '<div class="cy-dtp__panel"><div class="cy-dtp__calendar"><div class="cy-dtp__monthbar"><button type="button" aria-label="上个月" data-month="-1">‹</button><strong>' + year + '年' + (month + 1) + '月</strong><button type="button" aria-label="下个月" data-month="1">›</button></div>'
          + '<div class="cy-dtp__weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="cy-dtp__days">';
        for (var b = 0; b < firstWeekdayFromMonday(year, month); b++) html += '<span aria-hidden="true"></span>';
        for (var d = 1; d <= daysInMonth(year, month); d++) {
          var isSelected = draft.getFullYear() === year && draft.getMonth() === month && draft.getDate() === d;
          var today = new Date();
          var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
          html += '<button type="button" data-day="' + d + '" class="' + (isSelected ? "is-selected " : "") + (isToday ? "is-today" : "") + '" aria-pressed="' + isSelected + '">' + d + '</button>';
        }
        html += '</div></div><div class="cy-dtp__time"><label>小时<select class="cy-select" data-time="hour">';
        for (var h = 0; h < 24; h++) html += '<option value="' + h + '"' + (draft.getHours() === h ? " selected" : "") + '>' + pad2(h) + '</option>';
        html += '</select></label><label>分钟<select class="cy-select" data-time="minute">';
        for (var mi = 0; mi < 60; mi += 5) html += '<option value="' + mi + '"' + (draft.getMinutes() === mi ? " selected" : "") + '>' + pad2(mi) + '</option>';
        var hourAngle = (draft.getHours() % 12) * 30 + draft.getMinutes() * 0.5;
        var minuteAngle = draft.getMinutes() * 6;
        html += '</select></label><div class="cy-dtp__clock" aria-label="标准时钟表盘" style="--cy-dtp-clock-hour-angle:' + hourAngle + 'deg;--cy-dtp-clock-minute-angle:' + minuteAngle + 'deg">'
          + '<span class="cy-dtp__clock-hand cy-dtp__clock-hand--hour" aria-hidden="true"></span><span class="cy-dtp__clock-hand cy-dtp__clock-hand--minute" aria-hidden="true"></span><span class="cy-dtp__clock-center" aria-hidden="true"></span>';
        for (var ch = 1; ch <= 12; ch++) {
          html += '<span class="' + (draft.getHours() % 12 === ch % 12 ? "is-active" : "") + '" aria-label="' + ch + ' 点" style="transform:rotate(' + (ch * 30) + 'deg) translateY(-38px) rotate(' + (-ch * 30) + 'deg)">' + ch + '</span>';
        }
        html += '</div></div></div><div class="cy-dtp__presets" aria-label="快速预设"><button type="button" data-dtp-preset="1m">1分钟后</button><button type="button" data-dtp-preset="1h">1小时后</button><button type="button" data-dtp-preset="tomorrow9">明天9:00</button><button type="button" data-dtp-preset="1y">1年后</button><button type="button" data-dtp-preset="y2030">2030.01.01</button></div></div>';
      }
      root.innerHTML = html;
      if (open) window.setTimeout(updatePlacement);
    }
    function normalizeManual() {
      var values = {};
      root.querySelectorAll("[data-part]").forEach(function (el) {
        values[el.getAttribute("data-part")] = String(el.value || "").replace(/\D/g, "");
      });
      var y = Math.min(9999, Math.max(1, Number(values.year) || draft.getFullYear()));
      var m = Math.min(12, Math.max(1, Number(values.month) || draft.getMonth() + 1));
      var d = Math.min(daysInMonth(y, m - 1), Math.max(1, Number(values.day) || draft.getDate()));
      var h = Math.min(23, Math.max(0, Number(values.hour) || 0));
      var min = Math.min(59, Math.max(0, Number(values.minute) || 0));
      commitDraft(new Date(y, m - 1, d, h, min, 0, 0));
    }
    root.addEventListener("click", function (event) {
      var target = event.target;
      if (target.closest(".cy-dtp__trigger")) { open = !open; if (open) syncFromInput(); else render(); return; }
      if (target.closest("[data-dtp-cancel]")) { open = false; syncFromInput(); return; }
      if (target.closest("[data-dtp-confirm]")) { input.value = toLocalValue(draft); open = false; render(); return; }
      var monthBtn = target.closest("[data-month]");
      if (monthBtn) { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + Number(monthBtn.getAttribute("data-month")), 1); render(); return; }
      var dayBtn = target.closest("[data-day]");
      if (dayBtn) { draft.setFullYear(viewMonth.getFullYear(), viewMonth.getMonth(), Number(dayBtn.getAttribute("data-day"))); commitDraft(new Date(draft)); return; }
      var presetBtn = target.closest("[data-dtp-preset]");
      if (presetBtn) { commitDraft(pickerPresetDate(presetBtn.getAttribute("data-dtp-preset"))); }
    });
    root.addEventListener("change", function (event) {
      var target = event.target;
      if (target.matches("[data-time='hour']")) { draft.setHours(Number(target.value)); commitDraft(new Date(draft)); }
      if (target.matches("[data-time='minute']")) { draft.setMinutes(Number(target.value)); commitDraft(new Date(draft)); }
      if (target.matches("[data-part]")) normalizeManual();
    });
    root.addEventListener("keydown", function (event) {
      var part = event.target && event.target.getAttribute && event.target.getAttribute("data-part");
      if (!part || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      var delta = event.key === "ArrowUp" ? 1 : -1;
      var next = new Date(draft);
      if (part === "year") next.setFullYear(Math.min(9999, Math.max(1, next.getFullYear() + delta)));
      else if (part === "month") next.setMonth(next.getMonth() + delta);
      else if (part === "day") next.setDate(next.getDate() + delta);
      else if (part === "hour") next.setHours(next.getHours() + delta);
      else next.setMinutes(next.getMinutes() + delta);
      commitDraft(next);
    });
    document.addEventListener("pointerdown", function (event) {
      if (open && !root.contains(event.target)) { open = false; render(); }
    });
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    input.addEventListener("input", syncFromInput);
    render();
    return { sync: syncFromInput };
  }

  // ---------- 创建页 ----------
  (function () {
    var form = document.getElementById("create-form");
    if (!form) return;
    var titleInput = document.getElementById("title");
    var contentInput = document.getElementById("content");
    var openInput = document.getElementById("open_at");
    var openHidden = document.getElementById("openAt");
    var openPickerRoot = document.getElementById("open_at_picker");
    var aiBtn = document.getElementById("ai-generate");
    var recoArea = document.getElementById("reco-area");

    function presetTime(spec) {
      var now = new Date();
      switch (spec) {
        case "1m": now.setSeconds(now.getSeconds() + 130); break;
        case "1h": now.setHours(now.getHours() + 1); break;
        case "tomorrow9": now.setDate(now.getDate() + 1); now.setHours(9, 0, 0, 0); break;
        case "1y": now.setFullYear(now.getFullYear() + 1); break;
        case "y2030": return "2030-01-01T00:00";
      }
      return isoToLocalInput(now);
    }
    if (openInput && !openInput.value) openInput.value = presetTime("1h");
    var openPicker = initDateTimePicker(openPickerRoot, openInput);

    document.addEventListener("click", function (e) {
      var pb = e.target.closest("[data-preset]");
      if (pb && openInput) {
        openInput.value = presetTime(pb.getAttribute("data-preset"));
        if (openPicker) openPicker.sync();
      }
    });

    form.addEventListener("submit", function () {
      if (openInput && openHidden) {
        var d = new Date(openInput.value);
        openHidden.value = isNaN(d.getTime()) ? "" : d.toISOString();
      }
    });

    // ----- AI 灵感推荐 + 生成 -----
    var recos = [];
    var aiGenerated = false;
    var recoSeq = 0;

    function updateAiBtn() {
      if (aiBtn) aiBtn.textContent = aiGenerated ? "✨ 重新生成" : "✨ AI 生成";
    }

    function renderRecos() {
      if (!recoArea) return;
      var show = titleInput && !titleInput.value.trim() && recos.length > 0;
      if (!show) { recoArea.innerHTML = ""; return; }
      var html = '<div class="cy-field">'
        + '<div style="display:flex;align-items:center;gap:var(--space-2)">'
        + '<label style="margin:0">✨ 没有头绪？试试这些灵感</label>'
        + '<button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-testid="reco-refresh" id="reco-refresh" style="margin-left:auto">换一批</button>'
        + '</div><div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">';
      var palettes = ["brand", "accent", "signal"];
      recos.forEach(function (r, i) {
        var p = palettes[i % palettes.length];
        html += '<button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-testid="reco-chip"'
          + ' data-reco-title="' + escapeAttr(r.title) + '" title="' + escapeAttr(r.hint || "") + '"'
          + ' style="white-space:nowrap;border:1px solid var(--color-' + p + '-primary);border-radius:var(--radius-full)">'
          + escapeHtml(r.title) + "</button>";
      });
      html += "</div></div>";
      recoArea.innerHTML = html;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function escapeAttr(s) { return escapeHtml(s); }

    function loadRecos() {
      var seq = ++recoSeq;
      fetch("/api/v1/capsule-recommendations?count=4", { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (env) {
          if (seq !== recoSeq) return;
          var items = (env && env.data && env.data.items) || [];
          if (items.length > 0) { recos = items; renderRecos(); }
        })
        .catch(function () { /* 推荐失败静默：保留已有 */ });
    }

    function runAiGenerate(rawTitle) {
      var t = (rawTitle || "").trim();
      var autoTitle = !t;
      if (aiBtn) { aiBtn.disabled = true; aiBtn.textContent = "生成中…"; }
      fetch("/api/v1/capsule-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(t ? { title: t } : {})
      })
        .then(function (r) { return r.json(); })
        .then(function (env) {
          var s = env && env.data;
          if (!s) return;
          if (contentInput) contentInput.value = s.content || "";
          if (openInput && s.openAt) {
            openInput.value = isoToLocalInput(new Date(s.openAt));
            if (openPicker) openPicker.sync();
          }
          if (s.title && autoTitle && titleInput && !titleInput.value.trim()) titleInput.value = s.title;
          aiGenerated = true;
          renderRecos();
        })
        .catch(function () { /* 静默 */ })
        .finally(function () { if (aiBtn) aiBtn.disabled = false; updateAiBtn(); });
    }

    if (aiBtn) aiBtn.addEventListener("click", function () { runAiGenerate(titleInput ? titleInput.value : ""); });
    if (titleInput) titleInput.addEventListener("input", function () { renderRecos(); updateAiBtn(); });

    // 点击推荐 chip / 换一批（事件委托，元素动态生成）
    document.addEventListener("click", function (e) {
      var chip = e.target.closest('[data-testid="reco-chip"]');
      if (chip) {
        var rt = chip.getAttribute("data-reco-title");
        if (titleInput) titleInput.value = rt;
        if (contentInput) contentInput.value = "";
        aiGenerated = false;
        renderRecos();
        runAiGenerate(rt);
        return;
      }
      var refresh = e.target.closest('[data-testid="reco-refresh"]');
      if (refresh) { loadRecos(); }
    });

    updateAiBtn();
    loadRecos();
  })();

  // ---------- 资料页：保存改动 + 改密 ----------
  (function () {
    var profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var msgEl = document.getElementById("profile-msg");
        var nick = (document.getElementById("nick") || {}).value || "";
        var selected = profileForm.querySelector(".cy-avatar-picker__item.is-selected");
        var avatarId = selected ? selected.getAttribute("data-avatar-id") : null;
        var origNick = profileForm.getAttribute("data-orig-nick");
        var origAvatar = profileForm.getAttribute("data-orig-avatar");
        var patch = {};
        if (nick !== origNick) patch.nickname = nick.trim();
        if (avatarId && avatarId !== origAvatar) patch.avatarId = avatarId;
        if (Object.keys(patch).length === 0) { showMsg(msgEl, "info", "没有改动"); return; }
        fetch("/api/v1/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(patch)
        })
          .then(function (r) { return r.json().then(function (env) { return { ok: r.ok, env: env }; }); })
          .then(function (res) {
            if (res.ok && res.env.success) {
              showMsg(msgEl, "success", "已保存");
              profileForm.setAttribute("data-orig-nick", res.env.data.nickname);
              profileForm.setAttribute("data-orig-avatar", res.env.data.avatarId);
            } else {
              showMsg(msgEl, "danger", (res.env && res.env.message) || "保存失败");
            }
          })
          .catch(function () { showMsg(msgEl, "danger", "保存失败"); });
      });
    }

    var pwdForm = document.getElementById("password-form");
    if (pwdForm) {
      pwdForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var msgEl = document.getElementById("password-msg");
        var oldP = (document.getElementById("oldPwd") || {}).value || "";
        var newP = (document.getElementById("newPwd") || {}).value || "";
        var conf = (document.getElementById("confirmPwd") || {}).value || "";
        if (newP !== conf) { showMsg(msgEl, "danger", "两次输入的新密码不一致"); return; }
        fetch("/api/v1/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ currentPassword: oldP, newPassword: newP })
        })
          .then(function (r) {
            if (r.status === 204) {
              showMsg(msgEl, "success", "密码已更新，3 秒后将自动登出。");
              setTimeout(function () {
                var lf = document.getElementById("logout-form");
                if (lf) lf.submit(); else window.location.assign("/login");
              }, 3000);
            } else {
              r.json().then(function (env) { showMsg(msgEl, "danger", (env && env.message) || "修改失败"); });
            }
          })
          .catch(function () { showMsg(msgEl, "danger", "修改失败"); });
      });
    }
  })();
})();
