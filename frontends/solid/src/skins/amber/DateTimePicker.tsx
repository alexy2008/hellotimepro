// ============================================================
// 「琥珀」开启时间选择器：星轨时钟
// 结构、类名与交互照 2.0 原型 assets/js/amber/datetime.js（样式在 spec/styles/amber/components.css），
// 行为与 React 版 skins/amber/DateTimePicker.tsx 逐项对齐：
// - 触发条与输入框等宽；面板接在下方展开（不是浮层，不会被卡片裁掉），展开时滚进视口
// - 十年星轨：点年份穿越；拖动胶囊只换日子，时刻保留
// - 日历：方向键逐日 / 逐周；今天到选中日之间画「旅程线」
// - 昼夜表盘：先拖时针，松手切分针；分针越过 12 点进退一小时；指针角度累加不取模
// - 面板里的每次改动都夹进 LIMITS 的上下限再回调；外部（预设、AI 代笔、草稿恢复）改 value 时只同步显示
//
// SolidJS 写法：
// - 时间以 props.value（毫秒）为唯一数据源，不解构 props；草稿是 store，写入后同步可读，所以不需要「最新值」副本
// - 组件自己只管展开、月份视图、表盘模式这类界面状态，用 signal；其余都是 memo 派生
// - 每秒一跳（useNow）：触发条的相对时间、倒计时、星轨位置都跟着走；列表用 <Index> 就地打补丁，不会丢焦点与拖动状态
// - 挂载时 createEffect 会先跑一次，监听 value 的那个用 defer 跳过初值
// ============================================================

import { For, Index, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { clamp, pad2, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { LIMITS } from "@/primitives/capsuleForm";
import { useNow } from "@/primitives/now";

const MIN = 60000;
const DAY = 86400000;
const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DOW = ["一", "二", "三", "四", "五", "六", "日"];
const NODE_IDX = Array.from({ length: 11 }, (_, i) => i);

const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** 换到另一年 / 另一个月时，日子超出当月天数就落在月末（2 月 29 日 → 2 月 28 日） */
const moveTo = (ms: number, y: number, m: number) => {
  const d = new Date(ms);
  const day = d.getDate();
  d.setDate(1);
  d.setFullYear(y, m);
  d.setDate(Math.min(day, dim(y, m)));
  return d.getTime();
};
const addYears = (ms: number, n: number) => {
  const d = new Date(ms);
  return moveTo(ms, d.getFullYear() + n, d.getMonth());
};
const addMonths = (ms: number, n: number) => {
  const d = new Date(ms);
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return moveTo(ms, t.getFullYear(), t.getMonth());
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const monthOf = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const dayEnd = (t: number) => {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

function rel(t: number, now: number) {
  const ms = t - now;
  if (ms < 3600000) return `${Math.max(1, Math.round(ms / MIN))} 分钟后`;
  if (ms < DAY) return `${Math.round(ms / 3600000)} 小时后`;
  if (ms < 45 * DAY) return `${Math.round(ms / DAY)} 天后`;
  if (ms < 330 * DAY) return `约 ${Math.round(ms / (30.44 * DAY))} 个月后`;
  return `约 ${Math.round(ms / (365.25 * DAY))} 年后`;
}

/** 精确倒计时：按日历年、月逐级扣，剩下的换算成天 / 时 / 分；四舍五入到分钟 */
function eta(t: number, now: number): { n: number; u: string }[] {
  t += 30000;
  let cur = now;
  let y = 0;
  let mo = 0;
  while (addYears(cur, 1) <= t) {
    cur = addYears(cur, 1);
    y++;
  }
  while (addMonths(cur, 1) <= t) {
    cur = addMonths(cur, 1);
    mo++;
  }
  let ms = Math.max(0, t - cur);
  const d = Math.floor(ms / DAY);
  ms -= d * DAY;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / MIN);
  const parts: { n: number; u: string }[] = [];
  if (y) parts.push({ n: y, u: "年" });
  if (mo) parts.push({ n: mo, u: "个月" });
  if (d) parts.push({ n: d, u: "天" });
  parts.push({ n: h, u: "小时" }, { n: m, u: "分" });
  return parts;
}

/** 角度累加：59→0 时指针向前走一格，而不是倒转一整圈 */
const unwrap = (prev: number | null, next: number) => (prev == null ? next : prev + ((((next - prev) % 360) + 540) % 360) - 180);

// ---------------------------------------------------------------- 表盘的固定部分

const f2 = (n: number) => n.toFixed(2);
const DIAL_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 * Math.PI) / 180;
  const five = i % 5 === 0;
  const r1 = five ? 92 : 96;
  return { five, x1: f2(110 + r1 * Math.sin(a)), y1: f2(110 - r1 * Math.cos(a)), x2: f2(110 + 100 * Math.sin(a)), y2: f2(110 - 100 * Math.cos(a)) };
});
// 刻度圈：0 点琥珀三角，10/20…50 数字，其余每 5 分一道短条，前 15 分钟逐分细刻
const DIAL_BEZEL = Array.from({ length: 60 }, (_, i) => ({
  i,
  kind: i === 0 ? "lume" : i % 10 === 0 ? "num" : i % 5 === 0 ? "bar" : i < 15 ? "bar-s" : "dot",
  rot: `rotate(${i * 6} 110 110)`,
}));
const DIAL_NUMS = Array.from({ length: 12 }, (_, k) => k + 1)
  .filter((h) => h !== 3) // 3 点位让给日历窗
  .map((h) => {
    const a = (h * 30 * Math.PI) / 180;
    return { h, q: h % 3 === 0, x: f2(110 + 78 * Math.sin(a)), y: f2(110 - 78 * Math.cos(a)) };
  });

// ---------------------------------------------------------------- 组件

interface Props {
  /** 当前开启时间（毫秒） */
  value: number;
  /** 用户在面板里改动：已夹进上下限 */
  onChange: (t: number) => void;
}

export function DateTimePicker(props: Props) {
  /** 每秒一跳 */
  const now = useNow();

  const [open, setOpenSignal] = createSignal(false);
  const [mode, setMode] = createSignal<"h" | "m">("h");
  const [view, setView] = createSignal(monthOf(props.value));
  const [clamped, setClamped] = createSignal(false);
  const [railDragging, setRailDragging] = createSignal(false);
  const [dialDragging, setDialDragging] = createSignal(false);

  let root: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  let rail: HTMLDivElement | undefined;
  let grid: HTMLDivElement | undefined;
  let dial: SVGSVGElement | undefined;
  // 拖动是跨事件的状态，不需要触发重绘
  let railDrag = false;
  let dialDrag = false;
  // 面板自己刚发出的值：回流到 value 时不当作「外部改动」
  let emitted: number | null = null;

  // 外部（预设、AI 代笔、草稿恢复）改了时间：只同步月份视图与贴边提示，不回调。
  // defer：createEffect 挂载时会先跑一次，初值已经由 view 的初始化处理，不必再来一遍
  createEffect(
    on(
      () => props.value,
      (v) => {
        if (emitted === v) {
          emitted = null;
          return;
        }
        emitted = null;
        setView(monthOf(v));
        setClamped(false);
      },
      { defer: true },
    ),
  );

  /** 用户在面板里改动：夹进上下限 → 回调给页面（草稿是 store，写入后 props.value 立即是新值） */
  function pick(t: number, keepView = false) {
    const c = clamp(t, LIMITS.minOpen(), LIMITS.maxOpen());
    setClamped(c !== t);
    // 没变化就不会回流，别留一个过期的标记
    emitted = c !== props.value ? c : null;
    if (!keepView) setView(monthOf(c));
    props.onChange(c);
  }

  // ---- 开合：点触发条切换；「就这一刻」、Esc、点到组件与预设之外都收起
  function setOpen(o: boolean) {
    setOpenSignal(o);
    if (!o) setMode("h");
    else requestAnimationFrame(reveal);
  }
  /** 展开时把整块面板滚进视口：和展开动画同时进行；
   *  向上滚的距离以「触发条不被顶部导航挡住」为限，底部避开手机底栏 */
  function reveal() {
    const trig = root?.querySelector<HTMLElement>(".dtp__trigger");
    const inner = root?.querySelector<HTMLElement>(".dtp__in");
    if (!trig || !inner) return;
    const top = trig.getBoundingClientRect().top;
    const need = top + trig.offsetHeight + inner.offsetHeight;
    const bar = document.querySelector<HTMLElement>(".tabbar");
    const barH = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
    const headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
    const over = need - (window.innerHeight - barH - 16);
    const dy = Math.min(over, top - headH - 16);
    if (dy > 0) window.scrollBy({ top: dy, behavior: reducedMotion() ? "auto" : "smooth" });
  }
  // 展开动画一开始文档还没变长，上面那次滚动会被当时的最大滚动距离截断：
  // 动画结束（transitionend，约 500ms 定时兜底）后再补一次，只补剩下的距离。收起或卸载时清掉
  createEffect(() => {
    if (!open()) return;
    const panel = root?.querySelector<HTMLElement>(".dtp__panel");
    if (!panel) return;
    let timer = 0;
    const stop = () => {
      window.clearTimeout(timer);
      panel.removeEventListener("transitionend", onEnd);
    };
    const settle = () => {
      stop();
      reveal();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === panel && e.propertyName === "grid-template-rows") settle();
    };
    panel.addEventListener("transitionend", onEnd);
    timer = window.setTimeout(settle, 500);
    onCleanup(stop);
  });
  // 展开时才挂 document 监听，收起或组件卸载时清掉
  createEffect(() => {
    if (!open()) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (root && t && !root.contains(t) && !t.closest("[data-preset]")) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    onCleanup(() => document.removeEventListener("pointerdown", outside));
  });
  function closeAndFocus() {
    setOpen(false);
    trigger?.focus({ preventScroll: true });
  }
  // 原生监听（不走 Solid 的事件委托）：stopPropagation 才拦得住 document 上别处的 Esc 处理
  function onRootKey(e: KeyboardEvent) {
    if (e.key === "Escape" && open()) {
      e.stopPropagation();
      closeAndFocus();
    }
  }

  // ---- 十年星轨
  const maxOpen = createMemo(() => {
    now(); // 上限随时间走
    return LIMITS.maxOpen();
  });
  const frac = () => clamp((props.value - now()) / (maxOpen() - now()), 0, 1);
  function railTime(x: number) {
    const r = rail!.getBoundingClientRect();
    const c = new Date(props.value);
    const d = new Date(Date.now() + clamp((x - r.left) / r.width, 0, 1) * (LIMITS.maxOpen() - Date.now()));
    d.setHours(c.getHours(), c.getMinutes(), 0, 0); // 只换日子，时刻保留
    return d.getTime();
  }
  function onRailDown(e: PointerEvent & { currentTarget: HTMLDivElement }) {
    if ((e.target as Element).closest(".orbit__node")) return;
    railDrag = true;
    setRailDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    pick(railTime(e.clientX));
  }
  function onRailMove(e: PointerEvent) {
    if (railDrag) pick(railTime(e.clientX));
  }
  function endRail() {
    railDrag = false;
    setRailDragging(false);
  }
  function onCapKey(e: KeyboardEvent) {
    const n = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
    const y = ({ PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key];
    if (!n && !y) return;
    e.preventDefault();
    pick(n ? addMonths(props.value, n) : addYears(props.value, y));
  }
  function jumpToYear(i: number) {
    pick(moveTo(props.value, new Date().getFullYear() + i, new Date(props.value).getMonth()));
  }

  // ---- 日历
  function onGridKey(e: KeyboardEvent) {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    pick(props.value + step * DAY);
    // 方向键换日之后，格子可能整页换了月：渲染完把焦点交还给选中的那格
    queueMicrotask(() => grid?.querySelector<HTMLElement>(".is-sel")?.focus());
  }
  function pickDay(c: Date) {
    const t = new Date(props.value);
    pick(new Date(c.getFullYear(), c.getMonth(), c.getDate(), t.getHours(), t.getMinutes()).getTime(), true);
  }

  // ---- 表盘
  function setHM(h: number, m: number) {
    const d = new Date(props.value);
    d.setHours(h, m, 0, 0);
    pick(d.getTime());
  }
  function setAmPm(ap: "am" | "pm") {
    const d = new Date(props.value);
    const h = d.getHours();
    if (ap === "am" && h >= 12) setHM(h - 12, d.getMinutes());
    if (ap === "pm" && h < 12) setHM(h + 12, d.getMinutes());
  }
  function dialApply(e: PointerEvent) {
    const r = dial!.getBoundingClientRect();
    const a = ((Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI + 360) % 360;
    const d = new Date(props.value);
    const h = d.getHours();
    const m = d.getMinutes();
    if (mode() === "h") return setHM((Math.round(a / 30) % 12) + (h >= 12 ? 12 : 0), m);
    const nm = Math.round(a / 6) % 60;
    setHM(m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h, nm); // 越过 12 点进退一小时
  }
  function onDialDown(e: PointerEvent & { currentTarget: SVGSVGElement }) {
    dialDrag = true;
    setDialDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    dialApply(e);
  }
  function onDialMove(e: PointerEvent) {
    if (dialDrag) dialApply(e);
  }
  function endDial() {
    if (!dialDrag) return;
    dialDrag = false;
    setDialDragging(false);
    if (mode() === "h") setMode("m");
  }
  function onDialKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      setMode(mode() === "h" ? "m" : "h");
      return;
    }
    const k = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key];
    if (!k) return;
    e.preventDefault();
    pick(props.value + k * (mode() === "h" ? 60 : 1) * MIN);
  }

  // ---- 渲染所需的派生值
  const d = createMemo(() => new Date(props.value));
  const h = () => d().getHours();
  const m = () => d().getMinutes();
  // 指针角度累加（不取模）：外部改值也要跟着走，所以放在 memo 里，value 变一次才算一次
  const angH = createMemo<number>((prev) => unwrap(prev ?? null, ((h() % 12) + m() / 60) * 30));
  const angM = createMemo<number>((prev) => unwrap(prev ?? null, m() * 6));
  const isDay = () => h() >= 6 && h() < 18;
  // 日历格只在换日（零点）时才需要重算「今天」与上下限
  const todayStart = createMemo(() => dayStart(now()));
  const loMs = createMemo(() => {
    now(); // 下限也随时间走
    return dayStart(LIMITS.minOpen());
  });
  const hiMs = createMemo(() => dayEnd(maxOpen()));
  const thisYear = createMemo(() => new Date(now()).getFullYear());
  const vy = () => view().getFullYear();
  const vm = () => view().getMonth();
  const cells = createMemo(() => {
    const y = vy();
    const mo = vm();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const t0 = todayStart();
    const today = new Date(t0);
    const sel = d();
    const s0 = dayStart(sel.getTime());
    const lo = loMs();
    const hi = hiMs();
    return Array.from({ length: 42 }, (_, i) => {
      const c = new Date(y, mo, 1 - lead + i);
      const ct = c.getTime();
      const on = sameDay(c, sel);
      const cls = ["mcal__d"];
      if (c.getMonth() !== mo) cls.push("is-out");
      if (sameDay(c, today)) cls.push("is-today");
      if (ct > t0 && ct < s0) cls.push("is-span");
      if (on) cls.push("is-sel");
      return { c, on, cls: cls.join(" "), off: ct < lo || ct > hi };
    });
  });
  const yrs = () => vy() - thisYear();
  const parts = createMemo(() => eta(props.value, now()));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";

  return (
    <div ref={root} class={`dtp${open() ? " is-open" : ""}`} on:keydown={onRootKey}>
      <button
        ref={trigger}
        class="dtp__trigger"
        type="button"
        id="openAt"
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-controls="dtpPanel"
        aria-describedby="dtpVal"
        data-testid="create-openat"
        data-value={new Date(props.value).toISOString()}
        onClick={() => setOpen(!open())}
      >
        <Icon name="calendar" class="ic--cal" />
        <span class="dtp__val" id="dtpVal">
          <span class="dtp__date">{`${d().getFullYear()} 年 ${d().getMonth() + 1} 月 ${d().getDate()} 日`}</span>
          <span class="dtp__wd">{WD[d().getDay()]}</span>
          <span class="dtp__time">{`${pad2(h())}:${pad2(m())}`}</span>
        </span>
        <span class="dtp__rel">{rel(props.value, now())}</span>
        <Icon name="chev-down" class="ic--chev" />
      </button>
      <div class="dtp__panel" id="dtpPanel" role="dialog" aria-label="选择开启时间">
        <div class="dtp__clip">
          <div class="dtp__in">
            <div class="orbit">
              <div class="dtp__k">
                十年星轨<b>{`${(frac() * 10).toFixed(1)} / 10 年`}</b>
              </div>
              <div
                ref={rail}
                class={`orbit__rail${railDragging() ? " is-drag" : ""}`}
                onPointerDown={onRailDown}
                onPointerMove={onRailMove}
                onPointerUp={endRail}
                on:pointercancel={endRail}
              >
                <div class="orbit__line" />
                <div class="orbit__trail" style={{ width: `${(frac() * 100).toFixed(2)}%` }} />
                <div>
                  <For each={NODE_IDX}>
                    {(i) => (
                      <button
                        class={`orbit__node${i > 0 && i / 10 <= frac() + 1e-6 ? " is-past" : ""}${thisYear() + i === d().getFullYear() ? " is-cur" : ""}`}
                        type="button"
                        style={{ left: `${i * 10}%` }}
                        aria-label={`穿越到 ${thisYear() + i} 年`}
                        onClick={() => jumpToYear(i)}
                      >
                        <i />
                        <span>{i ? thisYear() + i : "今年"}</span>
                      </button>
                    )}
                  </For>
                </div>
                <div
                  class="orbit__cap"
                  style={{ left: `${(frac() * 100).toFixed(2)}%` }}
                  tabindex={0}
                  role="slider"
                  aria-label="沿十年星轨拖动胶囊（方向键按月，PageUp / PageDown 按年）"
                  aria-valuetext={`${d().getFullYear()} 年 ${d().getMonth() + 1} 月`}
                  onKeyDown={onCapKey}
                >
                  <svg viewBox="0 0 32 32" aria-hidden="true">
                    <path class="orbit__cap-top" d="M9 16V11a7 7 0 0 1 14 0v5Z" />
                    <path class="orbit__cap-bot" d="M9 16v5a7 7 0 0 0 14 0v-5Z" />
                    <rect class="orbit__cap-seam" x="8" y="15" width="16" height="2.2" rx="1.1" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="dtp__body">
              <div class="mcal">
                <div class="mcal__head">
                  <div class="mcal__title">
                    {`${vy()} 年 ${vm() + 1} 月`}
                    <small>{yrs() ? `${yrs()} 年后` : "今年"}</small>
                  </div>
                  <button class="mcal__nav" type="button" aria-label="上个月" disabled={new Date(vy(), vm(), 0).getTime() < loMs()} onClick={() => setView(new Date(vy(), vm() - 1, 1))}>
                    <Icon name="chev-left" />
                  </button>
                  <button class="mcal__nav" type="button" aria-label="下个月" disabled={new Date(vy(), vm() + 1, 1).getTime() > hiMs()} onClick={() => setView(new Date(vy(), vm() + 1, 1))}>
                    <Icon name="chev-right" />
                  </button>
                </div>
                <div class="mcal__dow">
                  <For each={DOW}>{(w) => <span>{w}</span>}</For>
                </div>
                <div ref={grid} class="mcal__grid" role="grid" aria-label="日期" onKeyDown={onGridKey}>
                  <Index each={cells()}>
                    {(cell) => (
                      <button
                        type="button"
                        role="gridcell"
                        class={cell().cls}
                        disabled={cell().off}
                        tabindex={cell().on ? 0 : -1}
                        aria-selected={cell().on}
                        aria-label={`${cell().c.getFullYear()}年${cell().c.getMonth() + 1}月${cell().c.getDate()}日`}
                        onClick={() => pickDay(cell().c)}
                      >
                        {cell().c.getDate()}
                      </button>
                    )}
                  </Index>
                </div>
              </div>

              <div class={`clock ${isDay() ? "is-day" : "is-night"}`} data-mode={mode()}>
                <div class="clock__read">
                  <div class="clock__seg">
                    <button type="button" class={mode() === "h" ? "is-on" : undefined} aria-label="调小时" onClick={() => setMode("h")}>
                      {pad2(h())}
                    </button>
                    <i>:</i>
                    <button type="button" class={mode() === "m" ? "is-on" : undefined} aria-label="调分钟" onClick={() => setMode("m")}>
                      {pad2(m())}
                    </button>
                  </div>
                  <div class="ampm">
                    <button type="button" class={h() < 12 ? "is-on" : undefined} onClick={() => setAmPm("am")}>
                      <Icon name="sun" />
                      上午
                    </button>
                    <button type="button" class={h() >= 12 ? "is-on" : undefined} onClick={() => setAmPm("pm")}>
                      <Icon name="moon" />
                      下午
                    </button>
                  </div>
                </div>
                <div class="clock__case">
                  <i class="clock__crown" aria-hidden="true" />
                  <svg
                    ref={dial}
                    class={`clock__dial${dialDragging() ? " is-drag" : ""}`}
                    viewBox="-12 -12 244 244"
                    tabindex="0"
                    role="slider"
                    aria-label="表盘：拖动指针调整时刻"
                    aria-valuetext={`${h()} 点 ${m()} 分`}
                    onPointerDown={onDialDown}
                    onPointerMove={onDialMove}
                    onPointerUp={endDial}
                    on:pointercancel={endDial}
                    onKeyDown={onDialKey}
                  >
                    <defs>
                      {/* amber-dtp-hand 的 id 被 spec 样式（.clock__hand--h line）按名字引用，不能改 */}
                      <linearGradient id="amber-dtp-hand" gradientUnits="userSpaceOnUse" x1="110" y1="118" x2="110" y2="58">
                        <stop class="clock__g-hand-a" offset="0" />
                        <stop class="clock__g-hand-b" offset="1" />
                      </linearGradient>
                      <radialGradient id="amber-dtp-day" cx=".5" cy=".78" r=".75">
                        <stop class="clock__g-day" offset="0" stop-opacity=".35" />
                        <stop class="clock__g-day" offset="1" stop-opacity="0" />
                      </radialGradient>
                      <radialGradient id="amber-dtp-night" cx=".5" cy=".3" r=".8">
                        <stop class="clock__g-night" offset="0" stop-opacity=".32" />
                        <stop class="clock__g-night" offset="1" stop-opacity="0" />
                      </radialGradient>
                      <radialGradient id="amber-dtp-edge" cx=".5" cy=".5" r=".5">
                        <stop class="clock__g-edge" offset=".82" stop-opacity="0" />
                        <stop class="clock__g-edge" offset="1" stop-opacity=".22" />
                      </radialGradient>
                      <clipPath id="amber-dtp-face">
                        <circle cx="110" cy="110" r="110" />
                      </clipPath>
                    </defs>
                    <circle class="clock__face" cx="110" cy="110" r="110" />
                    <g clip-path="url(#amber-dtp-face)">
                      <g class="clock__sky clock__sky--day">
                        <rect width="220" height="220" fill="url(#amber-dtp-day)" />
                        <circle class="clock__sun" cx="110" cy="160" r="13" />
                        <circle class="clock__sun clock__sun--halo" cx="110" cy="160" r="22" />
                      </g>
                      <g class="clock__sky clock__sky--night">
                        <rect width="220" height="220" fill="url(#amber-dtp-night)" />
                        <path class="clock__moon" d="M118 150a12 12 0 1 1-12.5-14 9.5 9.5 0 0 0 12.5 14Z" />
                        <g class="clock__stars">
                          <circle cx="72" cy="68" r="1.2" opacity=".8" />
                          <circle cx="150" cy="62" r="1" opacity=".6" />
                          <circle cx="160" cy="140" r="1.4" opacity=".7" />
                          <circle cx="58" cy="132" r="1" opacity=".5" />
                          <circle cx="132" cy="172" r=".9" opacity=".6" />
                          <circle cx="84" cy="172" r="1.1" opacity=".5" />
                        </g>
                      </g>
                    </g>
                    <circle class="clock__vignette" cx="110" cy="110" r="110" fill="url(#amber-dtp-edge)" />
                    <circle class="clock__rehaut" cx="110" cy="110" r="102" />
                    <g>
                      <For each={DIAL_TICKS}>{(t) => <line class={`clock__tick${t.five ? " is-5" : ""}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />}</For>
                    </g>
                    <g>
                      <For each={DIAL_NUMS}>
                        {(n) => (
                          <text class={`clock__num${n.q ? " is-q" : ""}`} x={n.x} y={n.y}>
                            {n.h}
                          </text>
                        )}
                      </For>
                    </g>
                    <g>
                      <For each={DIAL_BEZEL}>
                        {(b) =>
                          b.kind === "lume" ? (
                            <path class="clock__lume" d="M106 -9h8L110 -3Z" />
                          ) : b.kind === "num" ? (
                            <text class="clock__bz clock__bz-n" x="110" y="-5.5" transform={b.rot}>
                              {b.i}
                            </text>
                          ) : b.kind === "bar" ? (
                            <rect class="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" transform={b.rot} />
                          ) : b.kind === "bar-s" ? (
                            <rect class="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" transform={b.rot} />
                          ) : (
                            <circle class="clock__bz" cx="110" cy="-5.5" r=".7" transform={b.rot} />
                          )
                        }
                      </For>
                    </g>
                    <text class="clock__brand" x="110" y="64">
                      HELLOTIME
                    </text>
                    <text class="clock__brand clock__brand--sub" x="110" y="74">
                      Automatic · Sealed
                    </text>
                    <g class="clock__date">
                      <rect x="163" y="101" width="24" height="18" rx="3" />
                      <text x="175" y="110.5">
                        {d().getDate()}
                      </text>
                    </g>
                    <g class="clock__hand clock__hand--h" style={{ transform: `rotate(${angH()}deg)` }}>
                      <line x1="110" y1="118" x2="110" y2="58" />
                    </g>
                    <g class="clock__hand clock__hand--m" style={{ transform: `rotate(${angM()}deg)` }}>
                      <line x1="110" y1="124" x2="110" y2="44" />
                      <circle class="knob" cx="110" cy="44" r="4.5" />
                    </g>
                    <circle class="clock__pin" cx="110" cy="110" r="6" />
                    <path class="clock__glass" d="M30 92C40 52 74 26 116 22c-36 14-62 40-74 78-4 2-9 0-12-8Z" />
                  </svg>
                </div>
                <div class="clock__hint">{mode() === "h" ? "拖动时针，松手后自动切到分针" : "拖动分针，越过 12 点会自动进退一小时"}</div>
              </div>
            </div>

            <div class="dtp__foot">
              <div class="dtp__eta">
                胶囊将在{" "}
                <Index each={parts()}>
                  {(p, i) => (
                    <>
                      {i ? " " : null}
                      <b>{p().n}</b>
                      {p().u}
                    </>
                  )}
                </Index>{" "}
                后开启
                {clamped() ? <small class="is-warn">{`已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${tz}`}</small> : <small>{`按你所在的时区 ${tz} 计时`}</small>}
              </div>
              <button class="btn btn--primary btn--sm" type="button" onClick={closeAndFocus}>
                就这一刻
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
