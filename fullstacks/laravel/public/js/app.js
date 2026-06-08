(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function isoLocal(d) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function syncOpen() {
    var visible = qs("#open_at");
    var hidden = qs("#openAt");
    if (!visible || !hidden) return;
    var d = new Date(visible.value);
    hidden.value = isNaN(d.getTime()) ? "" : d.toISOString();
  }
  function preset(spec) {
    var d = new Date();
    if (spec === "1m") d.setSeconds(d.getSeconds() + 130);
    else if (spec === "1h") d.setHours(d.getHours() + 1);
    else if (spec === "tomorrow9") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    else if (spec === "1y") d.setFullYear(d.getFullYear() + 1);
    else if (spec === "y2030") { qs("#open_at").value = "2030-01-01T00:00"; syncOpen(); return; }
    qs("#open_at").value = isoLocal(d);
    syncOpen();
  }
  function installCreate() {
    var form = qs("#create-form");
    if (!form) return;
    var open = qs("#open_at");
    if (open && !open.value) open.value = isoLocal(new Date(Date.now() + 3600 * 1000));
    syncOpen();
    if (open) open.addEventListener("change", syncOpen);
    form.addEventListener("submit", syncOpen);
    qsa("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () { preset(b.dataset.preset); });
    });

    var title = qs("#title");
    var content = qs("#content");
    var recoArea = qs("#reco-area");
    var aiBtn = qs("#ai-generate");
    var aiInfo = qs("#ai-info");
    var recos = [];
    var aiGenerated = false;
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
      });
    }
    function renderRecos() {
      if (!recoArea) return;
      if (!title || title.value.trim() || recos.length === 0) { recoArea.innerHTML = ""; return; }
      var html = '<div class="cy-field"><div style="display:flex;align-items:center;gap:var(--space-2)">' +
        '<label style="margin:0">✨ 没有头绪？试试这些灵感</label>' +
        '<button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-testid="reco-refresh" style="margin-left:auto">换一批</button>' +
        '</div><div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">';
      var palettes = ["brand", "accent", "signal"]; // 三组主题色按下标轮换，仅勾边框做点缀
      recos.forEach(function (r, i) {
        var p = palettes[i % palettes.length];
        html += '<button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-testid="reco-chip" data-title="' +
          esc(r.title) + '" style="white-space:nowrap;border:1px solid var(--color-' + p + '-primary);border-radius:var(--radius-full)">' +
          esc(r.title) + '</button>';
      });
      recoArea.innerHTML = html + "</div></div>";
      qsa("[data-testid='reco-chip']", recoArea).forEach(function (chip) {
        chip.addEventListener("click", function () {
          title.value = chip.dataset.title || "";
          if (content) content.value = "";
          runAi(title.value);
          renderRecos();
        });
      });
      var refresh = qs("[data-testid='reco-refresh']", recoArea);
      if (refresh) refresh.addEventListener("click", loadRecos);
    }
    function loadRecos() {
      fetch("/api/v1/capsule-recommendations?count=4", { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (env) { recos = (env.data && env.data.items) || []; renderRecos(); })
        .catch(function () {});
    }
    function runAi(rawTitle) {
      if (!aiBtn) return;
      aiBtn.disabled = true;
      aiBtn.textContent = "生成中…";
      if (aiInfo) aiInfo.style.display = "none";
      var t = (rawTitle || "").trim();
      var autoTitle = !t;
      fetch("/api/v1/capsule-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(t ? { title: t } : {}),
      }).then(function (r) { return r.json(); }).then(function (env) {
        var s = env.data || {};
        if (s.title && title && !t) title.value = s.title;
        if (s.content && content) content.value = s.content;
        if (s.openAt && open) { open.value = isoLocal(new Date(s.openAt)); syncOpen(); }
        if (aiInfo && s.content) {
          var source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : (s.generatedBy || "未知模型");
          var titleNote = s.title && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
          aiInfo.textContent = titleNote + "，建议 " + (s.openInDays || 0) + " 天后开启 · 来源：" + source;
          aiInfo.style.display = "";
          aiGenerated = true;
        }
      }).catch(function () {}).finally(function () {
        aiBtn.disabled = false;
        aiBtn.textContent = aiGenerated ? "✨ 重新生成" : "✨ AI 生成";
      });
    }
    if (title) title.addEventListener("input", renderRecos);
    if (aiBtn) aiBtn.addEventListener("click", function () { runAi(title ? title.value : ""); });
    loadRecos();
  }
  function installSearch() {
    var input = qs(".cy-search__input");
    if (!input) return;
    var timer;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var url = new URL("/", location.origin);
        var sort = qs("input[name='sort']");
        var filter = qs("input[name='filter']");
        if (sort) url.searchParams.set("sort", sort.value);
        if (filter) url.searchParams.set("filter", filter.value);
        if (input.value.trim()) url.searchParams.set("q", input.value.trim());
        location.href = url.toString();
      }, 300);
    });
  }
  function installCodeInput() {
    var inputs = qsa(".cy-code-input input");
    if (inputs.length !== 8) return;
    function goIfDone() {
      var code = inputs.map(function (i) { return i.value; }).join("").toUpperCase();
      if (/^[A-Z0-9]{8}$/.test(code)) location.href = "/c/" + code;
    }
    inputs.forEach(function (input, idx) {
      input.addEventListener("input", function () {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 1);
        if (input.value && inputs[idx + 1]) inputs[idx + 1].focus();
        goIfDone();
      });
      input.addEventListener("paste", function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        text.split("").forEach(function (ch, i) { if (inputs[i]) inputs[i].value = ch; });
        goIfDone();
      });
    });
  }
  function installFavorites() {
    qsa(".cy-capsule__fav").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (!btn.dataset.authenticated) {
          if (confirm("登录后才能收藏，是否前往登录？")) location.href = "/login";
          return;
        }
        e.preventDefault();
        var id = btn.dataset.capsuleId;
        var active = btn.classList.contains("is-active");
        var xhr = new XMLHttpRequest();
        xhr.open(active ? "DELETE" : "POST", active ? "/api/v1/me/favorites/" + id : "/api/v1/me/favorites", false);
        xhr.setRequestHeader("Accept", "application/json");
        if (!active) xhr.setRequestHeader("Content-Type", "application/json");
        try {
          xhr.send(active ? null : JSON.stringify({ capsuleId: id }));
          if (xhr.status < 200 || xhr.status >= 300) return;
          var env = xhr.status === 204 || !xhr.responseText ? { data: null } : JSON.parse(xhr.responseText);
          btn.classList.toggle("is-active", !active);
          var count = btn.querySelector("[data-fav-count]");
          if (count && env.data && typeof env.data.favoriteCount === "number") count.textContent = env.data.favoriteCount;
          else if (count) count.textContent = String(Math.max(0, Number(count.textContent || "0") + (active ? -1 : 1)));
        } catch (_) {}
      });
    });
  }
  function installProfile() {
    var save = qs("#profile-save");
    var msg = qs("#profile-msg");
    function show(text, good) {
      if (!msg) return;
      msg.textContent = text;
      msg.className = "cy-alert " + (good ? "cy-alert--success" : "cy-alert--danger");
      msg.hidden = false;
    }
    if (save) save.addEventListener("click", function () {
      var nick = qs("#nick");
      var avatar = qs("input[name='avatarId']:checked");
      var payload = {};
      if (nick && nick.value !== nick.dataset.initial) payload.nickname = nick.value;
      if (avatar && avatar.value !== avatar.dataset.initial) payload.avatarId = avatar.value;
      if (!Object.keys(payload).length) { show("没有改动", true); return; }
      fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }).then(function (r) { return r.json(); }).then(function (env) {
        if (env.success) {
          if (nick) nick.dataset.initial = env.data.nickname;
          qsa("input[name='avatarId']").forEach(function (i) { i.dataset.initial = env.data.avatarId; });
          var chip = qs(".cy-user-chip--button");
          if (chip) chip.setAttribute("title", env.data.nickname);
          show("已保存", true);
        } else show(env.message || "保存失败", false);
      });
    });
    var pwd = qs("#password-save");
    if (pwd) pwd.addEventListener("click", function () {
      var oldPwd = qs("#oldPwd"), newPwd = qs("#newPwd"), confirmPwd = qs("#confirmPwd");
      if (newPwd.value !== confirmPwd.value) { show("两次输入的新密码不一致", false); return; }
      fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ currentPassword: oldPwd.value, newPassword: newPwd.value }),
      }).then(function (r) {
        if (r.status === 204) { oldPwd.value = newPwd.value = confirmPwd.value = ""; show("密码已更新", true); return null; }
        return r.json().then(function (env) { show(env.message || "更新失败", false); });
      });
    });
  }
  function installShare() {
    qsa("[data-copy-code]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.dataset.copyCode || "";
        if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
        btn.textContent = "已复制";
        setTimeout(function () { btn.textContent = "复制胶囊码"; }, 1200);
      });
    });
    qsa("[data-share-code]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = location.origin + "/c/" + (btn.dataset.shareCode || "");
        if (navigator.share) navigator.share({ title: "HelloTime Pro 时间胶囊", url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
      });
    });
    qsa(".cy-avatar-picker__item input[name='avatarId']").forEach(function (input) {
      input.addEventListener("change", function () {
        qsa(".cy-avatar-picker__item").forEach(function (label) {
          label.classList.remove("is-selected");
          label.setAttribute("aria-checked", "false");
        });
        var label = input.closest(".cy-avatar-picker__item");
        if (label) { label.classList.add("is-selected"); label.setAttribute("aria-checked", "true"); }
      });
    });
  }
  function installMenu() {
    var chip = qs(".cy-user-chip--button"), menu = qs(".cy-user-dropdown");
    if (!chip || !menu) return;
    chip.addEventListener("click", function () {
      var open = menu.hasAttribute("hidden");
      if (open) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
      chip.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function installCountdowns() {
    qsa("[data-open-at]").forEach(function (el) {
      var target = new Date(el.dataset.openAt).getTime();
      if (!target) return;
      function tick() {
        var diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
        var days = Math.floor(diff / 86400);
        var hours = Math.floor((diff % 86400) / 3600);
        var mins = Math.floor((diff % 3600) / 60);
        var secs = diff % 60;
        if (el.dataset.compact === "1") el.textContent = "⏳ 还剩 " + days + " 天 · " + pad(hours) + ":" + pad(mins) + ":" + pad(secs);
        qsa("[data-unit]", el).forEach(function (u) {
          var k = u.dataset.unit;
          u.textContent = k === "days" ? String(days) : pad(k === "hours" ? hours : k === "minutes" ? mins : secs);
        });
      }
      tick();
      setInterval(tick, 1000);
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    installCreate();
    installSearch();
    installCodeInput();
    installFavorites();
    installProfile();
    installMenu();
    installCountdowns();
    installShare();
  });
})();
