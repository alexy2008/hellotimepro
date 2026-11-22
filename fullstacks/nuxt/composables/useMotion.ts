// ============================================================
// 两个小动效，几个部件共用：
// - useShake：某个值变了（出错次数 +1、错误文案换了）就加 is-shake 480ms
// - useSlider：分段控件 / 页签 / 导航下面那块跟着当前项滑动的底（thumb / ink）
// ============================================================

import { onBeforeUnmount, onMounted, onScopeDispose, ref, watch, type CSSProperties, type Ref, type WatchSource } from "vue";

export function useShake(source: WatchSource<unknown>) {
  const on = ref(false);
  let t = 0;
  watch(source, (v) => {
    if (!v) return;
    on.value = true;
    clearTimeout(t);
    t = window.setTimeout(() => (on.value = false), 480);
  });
  onScopeDispose(() => clearTimeout(t));
  return on;
}

/**
 * 量出 box 里当前项（selector）的位置，让滑块对齐过去。
 * 首次定位不带过渡；deps 变了（选中项、数量、登录态…）在 DOM 更新之后再量一次；
 * 窗口尺寸变化、字体晚到（会改变按钮宽度）时也重新量。
 * hideWhenNone：没有当前项时把滑块藏起来（琥珀顶栏在详情页之类没有高亮项）。
 */
export function useSlider(box: Readonly<Ref<HTMLElement | null>>, selector: string, deps: WatchSource[], hideWhenNone = false) {
  const style = ref<CSSProperties>(hideWhenNone ? { opacity: 0 } : {});

  const place = (animate: boolean) => {
    const a = box.value?.querySelector<HTMLElement>(selector);
    if (!a) {
      if (hideWhenNone) style.value = { opacity: 0 };
      return;
    }
    style.value = {
      ...(hideWhenNone ? { opacity: 1 } : {}),
      width: `${a.offsetWidth}px`,
      transform: `translateX(${a.offsetLeft}px)`,
      transition: animate ? undefined : "none",
    };
  };
  const still = () => place(false);

  onMounted(() => {
    place(false);
    void document.fonts?.ready.then(still);
    window.addEventListener("resize", still);
  });
  onBeforeUnmount(() => window.removeEventListener("resize", still));
  watch(deps, () => place(true), { flush: "post" });

  return style;
}
