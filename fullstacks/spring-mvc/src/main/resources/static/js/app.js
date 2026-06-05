/* ============================================================
 * HelloTime Pro · Spring MVC + Thymeleaf 全栈的渐进增强脚本
 *
 * SSR 负责整页与（经 HTMX）局部刷新；本文件只承载「天然属于浏览器」的交互：
 *   - 主题切换、用户菜单下拉
 *   - 头像选择器、8 位胶囊码输入
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

  // ---------- 创建页 ----------
  (function () {
    var form = document.getElementById("create-form");
    if (!form) return;
    var titleInput = document.getElementById("title");
    var contentInput = document.getElementById("content");
    var openInput = document.getElementById("open_at");
    var openHidden = document.getElementById("openAt");
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

    document.addEventListener("click", function (e) {
      var pb = e.target.closest("[data-preset]");
      if (pb && openInput) openInput.value = presetTime(pb.getAttribute("data-preset"));
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
          if (openInput && s.openAt) openInput.value = isoToLocalInput(new Date(s.openAt));
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
