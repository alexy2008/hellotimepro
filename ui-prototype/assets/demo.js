// UI 原型的少量交互：主题切换 + 片段切换 tabs
// 仅服务于静态页面演示；生产实现由各前端替代

(function () {
  const THEME_KEY = "hellotime-pro:theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }

  function initTheme() {
    let theme;
    try {
      theme = localStorage.getItem(THEME_KEY);
    } catch {}
    if (!theme) {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    applyTheme(theme);
  }

  function wireToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next =
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        applyTheme(next);
        btn.querySelector("[data-theme-toggle-icon]")?.replaceChildren(
          document.createTextNode(next === "dark" ? "☾" : "☀"),
        );
      });
    });
  }

  function wireSegments() {
    document.querySelectorAll("[data-seg]").forEach((group) => {
      group.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          group
            .querySelectorAll("button")
            .forEach((b) => b.classList.remove("cy-seg__active"));
          btn.classList.add("cy-seg__active");
        });
      });
    });
  }

  function wireFavorites() {
    document.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("is-active");
      });
    });
  }

  function wireUserDropdown() {
    document.querySelectorAll(".cy-user-chip--button").forEach((btn) => {
      const menu = btn.closest(".cy-user-menu");
      const dropdown = menu?.querySelector(".cy-user-dropdown");
      if (!dropdown) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = dropdown.style.display !== "none" && dropdown.style.display !== "";
        dropdown.style.display = open ? "none" : "block";
        btn.setAttribute("aria-expanded", String(!open));
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".cy-user-dropdown").forEach((d) => {
        d.style.display = "none";
        d.closest(".cy-user-menu")?.querySelector("[aria-expanded]")?.setAttribute("aria-expanded", "false");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    wireToggles();
    wireSegments();
    wireFavorites();
    wireUserDropdown();
  });

  // 立刻应用以避免 FOUC
  initTheme();
})();
