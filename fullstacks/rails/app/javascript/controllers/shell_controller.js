import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import { promptLogin, reducedMotion } from "lib/ui";

import { placeMeTabs, placeSelection, syncSkinHooks } from "lib/skin_view";
import { syncDraftOwner } from "lib/draft";

const root = document.documentElement;

export default class extends Controller {
  static targets = ["skinOption", "themeButton", "menu", "header"];
  static values = { user: String };
  static transition;

  connect() {
    syncDraftOwner(this.userValue);
    this.sync();
    this.skinOptionTargets.forEach((button) => { button.disabled = false; });
    this.themeButtonTarget.disabled = false;
    this.scroll();
    document.fonts?.ready.then(() => { if (this.element.isConnected) this.placeNavInk(); });
    this.element.querySelectorAll("#toasts .toast").forEach((item) => setTimeout(() => item.remove(), 3500));
  }

  skin({ currentTarget: button }) {
    const next = button.dataset.value;
    if (next === root.dataset.skin) return;
    this.transition("skin", next, () => {
      root.dataset.skinDir = next === "paper" ? "prev" : "next";
      root.classList.add("is-skinning");
    });
  }

  theme(event) {
    const button = event.currentTarget.getBoundingClientRect();
    const x = event.detail ? event.clientX : button.x + button.width / 2;
    const y = event.detail ? event.clientY : button.y + button.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = this.transition("theme", root.dataset.theme === "dark" ? "light" : "dark",
      () => root.classList.add("is-theming"));
    transition?.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 600, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
  }

  transition(key, value, before) {
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      root.dataset[key] = value;
      try { localStorage.setItem(`hellotime.${key}`, value); } catch {}
      if (this.element.isConnected) this.sync();
      document.dispatchEvent(new CustomEvent(`hellotime:${key}`));
    };

    const previous = this.constructor.transition;
    previous?.skipTransition();
    delete root.dataset.skinDir;
    root.classList.remove("is-skinning", "is-theming");
    if (reducedMotion() || !document.startViewTransition) {
      apply();
      return;
    }

    before?.();
    const current = document.startViewTransition(apply);
    const fallback = setTimeout(() => {
      if (this.constructor.transition === current) apply();
    }, 380);
    this.constructor.transition = current;
    current.finished.catch(() => {}).finally(() => {
      clearTimeout(fallback);
      if (this.constructor.transition === current) {
        delete root.dataset.skinDir;
        root.classList.remove("is-skinning", "is-theming");
        this.constructor.transition = null;
      }
    });
    return current;
  }

  sync() {
    syncSkinHooks(this.element);
    this.placeNavInk();
    this.skinOptionTargets.forEach((button) => {
      const active = button.dataset.value === root.dataset.skin;
      button.dataset.selected = active;
      button.setAttribute("aria-checked", active);
      button.classList.toggle("is-active", active);
    });
    const dark = root.dataset.theme === "dark";
    this.themeButtonTarget.setAttribute("aria-checked", String(dark));
    this.themeButtonTarget.setAttribute("aria-label", dark ? "切换到日间主题" : "切换到夜间主题");
  }

  placeNavInk() {
    const ink = this.headerTarget.querySelector(".nav__ink");
    placeSelection(ink?.parentElement, ink);
    placeMeTabs(this.element);
  }

  scroll() {
    this.headerTarget.classList.toggle("is-scrolled", window.scrollY > 6);
  }

  toggleMenu() {
    this.setMenu(!this.menuTarget.classList.contains("is-open"));
  }

  closeOutside(event) {
    if (this.hasMenuTarget && !this.menuTarget.contains(event.target)) this.closeMenu();
  }

  closeMenu() {
    if (this.hasMenuTarget) this.setMenu(false);
  }

  setMenu(open) {
    this.menuTarget.classList.toggle("is-open", open);
    this.menuTarget.querySelector("[aria-haspopup]").setAttribute("aria-expanded", open);
    this.menuTarget.querySelector('[role="menu"]').hidden = !open;
  }

  async requireLogin(event) {
    if (this.userValue) return;
    event.preventDefault();
    const destination = await promptLogin("写胶囊", "/create");
    if (destination && this.element.isConnected) Turbo.visit(destination);
  }
}
