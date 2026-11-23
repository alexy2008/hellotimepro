// 两套 ERB 标签随首屏 HTML 到达，只有当前皮肤的操作钩子参与交互与定位。
export function syncSkinHooks(root) {
  const skin = document.documentElement.dataset.skin;
  root.querySelectorAll("[data-view-testid]").forEach((node) => {
    if (!node.closest("[hidden]") && node.closest("[data-skin-only]")?.dataset.skinOnly === skin) {
      node.dataset.testid = node.dataset.viewTestid;
    } else {
      delete node.dataset.testid;
    }
  });
}

export function placeSelection(container, indicator) {
  if (!container || !indicator) return;
  const active = container.querySelector(".is-active");
  indicator.style.opacity = active ? "1" : "0";
  if (active) {
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  }
}

export function placeMeTabs(root) {
  const skin = document.documentElement.dataset.skin;
  const tabs = root.querySelector(`.me__tabs[data-skin-only="${skin}"]`);
  const panel = skin === "paper" ? tabs : tabs?.querySelector(".seg");
  placeSelection(panel, panel?.querySelector(".tabs__ink, .seg__thumb"));
}
