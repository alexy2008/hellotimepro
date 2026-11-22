// ============================================================
// 「琥珀」开启时间选择器：星轨时钟
// 结构、类名与交互照 2.0 原型 assets/js/amber/datetime.js（样式在 spec/styles/amber/components.css）。
// - 触发条与输入框等宽；面板接在下方展开（不是浮层，不会被卡片裁掉）
// - 十年星轨：点年份穿越；拖动胶囊只换日子，时刻保留
// - 日历：方向键逐日 / 逐周；今天到选中日之间画「旅程线」
// - 昼夜表盘：先拖时针，松手切分针；分针越过 12 点进退一小时；指针角度累加不取模
// - 面板里的每次改动都夹进 LIMITS 的上下限再回调；外部（预设、AI 代笔、草稿恢复）改 value 时只同步显示
// 时间以 value（毫秒）为唯一数据源；组件自己只管展开、月份视图、表盘模式这类界面状态
// ============================================================

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import { clamp, pad2, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { LIMITS } from "@/hooks/useCreateCapsule";

const MIN = 60000;
const DAY = 86400000;
const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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

function rel(t: number) {
  const ms = t - Date.now();
  if (ms < 3600000) return `${Math.max(1, Math.round(ms / MIN))} 分钟后`;
  if (ms < DAY) return `${Math.round(ms / 3600000)} 小时后`;
  if (ms < 45 * DAY) return `${Math.round(ms / DAY)} 天后`;
  if (ms < 330 * DAY) return `约 ${Math.round(ms / (30.44 * DAY))} 个月后`;
  return `约 ${Math.round(ms / (365.25 * DAY))} 年后`;
}

/** 精确倒计时：按日历年、月逐级扣，剩下的换算成天 / 时 / 分；四舍五入到分钟 */
function eta(t: number): { n: number; u: string }[] {
  t += 30000;
  let cur = Date.now();
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
const DIAL_TICKS: ReactElement[] = [];
const DIAL_BEZEL: ReactElement[] = [];
for (let i = 0; i < 60; i++) {
  const a = (i * 6 * Math.PI) / 180;
  const five = i % 5 === 0;
  const r1 = five ? 92 : 96;
  DIAL_TICKS.push(
    <line key={i} className={`clock__tick${five ? " is-5" : ""}`} x1={f2(110 + r1 * Math.sin(a))} y1={f2(110 - r1 * Math.cos(a))} x2={f2(110 + 100 * Math.sin(a))} y2={f2(110 - 100 * Math.cos(a))} />,
  );
  // 刻度圈：0 点琥珀三角，10/20…50 数字，其余每 5 分一道短条，前 15 分钟逐分细刻
  const rot = `rotate(${i * 6} 110 110)`;
  if (i === 0) DIAL_BEZEL.push(<path key={i} className="clock__lume" d="M106 -9h8L110 -3Z" />);
  else if (i % 10 === 0)
    DIAL_BEZEL.push(
      <text key={i} className="clock__bz clock__bz-n" x="110" y="-5.5" transform={rot}>
        {i}
      </text>,
    );
  else if (five) DIAL_BEZEL.push(<rect key={i} className="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" transform={rot} />);
  else if (i < 15) DIAL_BEZEL.push(<rect key={i} className="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" transform={rot} />);
  else DIAL_BEZEL.push(<circle key={i} className="clock__bz" cx="110" cy="-5.5" r=".7" transform={rot} />);
}
const DIAL_NUMS: ReactElement[] = [];
for (let h = 1; h <= 12; h++) {
  if (h === 3) continue; // 3 点位让给日历窗
  const a = (h * 30 * Math.PI) / 180;
  DIAL_NUMS.push(
    <text key={h} className={`clock__num${h % 3 === 0 ? " is-q" : ""}`} x={f2(110 + 78 * Math.sin(a))} y={f2(110 - 78 * Math.cos(a))}>
      {h}
    </text>,
  );
}
const NODE_IDX = Array.from({ length: 11 }, (_, i) => i);
const DOW = ["一", "二", "三", "四", "五", "六", "日"];

// ---------------------------------------------------------------- 组件

interface Props {
  /** 当前开启时间（毫秒） */
  value: number;
  /** 用户在面板里改动：已夹进上下限 */
  onChange: (t: number) => void;
}

export function DateTimePicker({ value, onChange }: Props) {
  const [open, setOpenState] = useState(false);
  const [mode, setMode] = useState<"h" | "m">("h");
  const [view, setView] = useState(() => monthOf(value));
  const [clamped, setClamped] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  // 拖动是跨事件的状态，不需要触发重绘
  const railDrag = useRef(false);
  const dialDrag = useRef(false);
  const [dragging, setDragging] = useState({ rail: false, dial: false });
  // 最新的时刻：同一帧里连来的 pointermove 不会读到上一次渲染的旧值
  const cur = useRef(value);
  cur.current = value;
  // 面板自己刚发出的值：回流到 value 时不当作「外部改动」
  const emitted = useRef<number | null>(null);
  const focusSel = useRef(false);
  const angH = useRef<number | null>(null);
  const angM = useRef<number | null>(null);

  // 外部（预设、AI 代笔、草稿恢复）改了时间：只同步月份视图与贴边提示，不回调
  useLayoutEffect(() => {
    if (emitted.current === value) {
      emitted.current = null;
      return;
    }
    emitted.current = null;
    setView(monthOf(value));
    setClamped(false);
  }, [value]);

  /** 用户在面板里改动：夹进上下限 → 回调给页面 */
  function pick(t: number, keepView = false) {
    const c = clamp(t, LIMITS.minOpen(), LIMITS.maxOpen());
    setClamped(c !== t);
    emitted.current = c;
    cur.current = c;
    if (!keepView) setView(monthOf(c));
    onChange(c);
  }

  // ---- 开合：点触发条切换；「就这一刻」、Esc、点到组件与预设之外都收起
  function setOpen(o: boolean) {
    setOpenState(o);
    if (!o) setMode("h");
    else requestAnimationFrame(reveal);
  }
  /** 展开时把整块面板滚进视口：和展开动画同时进行；
   *  向上滚的距离以「触发条不被顶部导航挡住」为限，底部避开手机底栏 */
  function reveal() {
    const el = root.current;
    const trig = el?.querySelector<HTMLElement>(".dtp__trigger");
    const inner = el?.querySelector<HTMLElement>(".dtp__in");
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
  useEffect(() => {
    if (!open) return;
    const panel = root.current?.querySelector<HTMLElement>(".dtp__panel");
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
    return stop;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: globalThis.PointerEvent) => {
      const t = e.target as Element | null;
      if (root.current && t && !root.current.contains(t) && !t.closest("[data-preset]")) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const closeAndFocus = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  // ---- 十年星轨
  const now = Date.now();
  const maxOpen = LIMITS.maxOpen();
  const f = clamp((value - now) / (maxOpen - now), 0, 1);
  const railTime = (x: number) => {
    const r = rail.current!.getBoundingClientRect();
    const c = new Date(cur.current);
    const d = new Date(Date.now() + clamp((x - r.left) / r.width, 0, 1) * (LIMITS.maxOpen() - Date.now()));
    d.setHours(c.getHours(), c.getMinutes(), 0, 0); // 只换日子，时刻保留
    return d.getTime();
  };
  const onRailDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest(".orbit__node")) return;
    railDrag.current = true;
    setDragging((s) => ({ ...s, rail: true }));
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    pick(railTime(e.clientX));
  };
  const onRailMove = (e: PointerEvent<HTMLDivElement>) => {
    if (railDrag.current) pick(railTime(e.clientX));
  };
  const endRail = () => {
    railDrag.current = false;
    setDragging((s) => (s.rail ? { ...s, rail: false } : s));
  };
  const onCapKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
    const y = ({ PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key];
    if (!n && !y) return;
    e.preventDefault();
    pick(n ? addMonths(cur.current, n) : addYears(cur.current, y));
  };

  // ---- 日历
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    focusSel.current = true;
    pick(cur.current + step * DAY);
  };
  // 方向键换日之后，格子可能整页换了月：渲染完把焦点交还给选中的那格
  useEffect(() => {
    if (!focusSel.current) return;
    focusSel.current = false;
    grid.current?.querySelector<HTMLElement>(".is-sel")?.focus();
  });

  // ---- 表盘
  const setHM = (h: number, m: number) => {
    const d = new Date(cur.current);
    d.setHours(h, m, 0, 0);
    pick(d.getTime());
  };
  const setAmPm = (ap: "am" | "pm") => {
    const d = new Date(cur.current);
    const h = d.getHours();
    if (ap === "am" && h >= 12) setHM(h - 12, d.getMinutes());
    if (ap === "pm" && h < 12) setHM(h + 12, d.getMinutes());
  };
  function dialApply(e: PointerEvent<SVGSVGElement>) {
    const r = dial.current!.getBoundingClientRect();
    const a = ((Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI + 360) % 360;
    const d = new Date(cur.current);
    const h = d.getHours();
    const m = d.getMinutes();
    if (mode === "h") return setHM((Math.round(a / 30) % 12) + (h >= 12 ? 12 : 0), m);
    const nm = Math.round(a / 6) % 60;
    setHM(m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h, nm); // 越过 12 点进退一小时
  }
  const onDialDown = (e: PointerEvent<SVGSVGElement>) => {
    dialDrag.current = true;
    setDragging((s) => ({ ...s, dial: true }));
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    dialApply(e);
  };
  const onDialMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dialDrag.current) dialApply(e);
  };
  const endDial = () => {
    if (!dialDrag.current) return;
    dialDrag.current = false;
    setDragging((s) => ({ ...s, dial: false }));
    if (mode === "h") setMode("m");
  };
  const onDialKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      return setMode(mode === "h" ? "m" : "h");
    }
    const k = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key];
    if (!k) return;
    e.preventDefault();
    pick(cur.current + k * (mode === "h" ? 60 : 1) * MIN);
  };

  // ---- 渲染所需的派生值
  const d = new Date(value);
  const h = d.getHours();
  const m = d.getMinutes();
  angH.current = unwrap(angH.current, ((h % 12) + m / 60) * 30);
  angM.current = unwrap(angM.current, m * 6);
  const isDay = h >= 6 && h < 18;
  const today = new Date();
  const Y = today.getFullYear();
  const vy = view.getFullYear();
  const vm = view.getMonth();
  const lo = new Date(LIMITS.minOpen());
  lo.setHours(0, 0, 0, 0);
  const hi = new Date(maxOpen);
  hi.setHours(23, 59, 59, 999);
  const lead = (new Date(vy, vm, 1).getDay() + 6) % 7;
  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  const s0 = new Date(d);
  s0.setHours(0, 0, 0, 0);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const c = new Date(vy, vm, 1 - lead + i);
    return { c, sel: sameDay(c, d), key: `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}` };
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
  const yrs = vy - Y;

  return (
    <div
      ref={root}
      className={`dtp${open ? " is-open" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          closeAndFocus();
        }
      }}
    >
      <button
        ref={trigger}
        className="dtp__trigger"
        type="button"
        id="openAt"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="dtpPanel"
        aria-describedby="dtpVal"
        data-testid="create-openat"
        data-value={new Date(value).toISOString()}
        onClick={() => setOpen(!open)}
      >
        <Icon name="calendar" className="ic--cal" />
        <span className="dtp__val" id="dtpVal">
          <span className="dtp__date">{`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`}</span>
          <span className="dtp__wd">{WD[d.getDay()]}</span>
          <span className="dtp__time">{`${pad2(h)}:${pad2(m)}`}</span>
        </span>
        <span className="dtp__rel">{rel(value)}</span>
        <Icon name="chev-down" className="ic--chev" />
      </button>
      <div className="dtp__panel" id="dtpPanel" role="dialog" aria-label="选择开启时间">
        <div className="dtp__clip">
          <div className="dtp__in">
            <div className="orbit">
              <div className="dtp__k">
                十年星轨<b>{`${(f * 10).toFixed(1)} / 10 年`}</b>
              </div>
              <div
                ref={rail}
                className={`orbit__rail${dragging.rail ? " is-drag" : ""}`}
                onPointerDown={onRailDown}
                onPointerMove={onRailMove}
                onPointerUp={endRail}
                onPointerCancel={endRail}
              >
                <div className="orbit__line" />
                <div className="orbit__trail" style={{ width: `${(f * 100).toFixed(2)}%` }} />
                <div>
                  {NODE_IDX.map((i) => (
                    <button
                      key={i}
                      className={`orbit__node${i > 0 && i / 10 <= f + 1e-6 ? " is-past" : ""}${Y + i === d.getFullYear() ? " is-cur" : ""}`}
                      type="button"
                      style={{ left: `${i * 10}%` }}
                      aria-label={`穿越到 ${Y + i} 年`}
                      onClick={() => pick(moveTo(cur.current, new Date().getFullYear() + i, new Date(cur.current).getMonth()))}
                    >
                      <i />
                      <span>{i ? Y + i : "今年"}</span>
                    </button>
                  ))}
                </div>
                <div
                  className="orbit__cap"
                  style={{ left: `${(f * 100).toFixed(2)}%` }}
                  tabIndex={0}
                  role="slider"
                  aria-label="沿十年星轨拖动胶囊（方向键按月，PageUp / PageDown 按年）"
                  aria-valuetext={`${d.getFullYear()} 年 ${d.getMonth() + 1} 月`}
                  onKeyDown={onCapKey}
                >
                  <svg viewBox="0 0 32 32" aria-hidden="true">
                    <path className="orbit__cap-top" d="M9 16V11a7 7 0 0 1 14 0v5Z" />
                    <path className="orbit__cap-bot" d="M9 16v5a7 7 0 0 0 14 0v-5Z" />
                    <rect className="orbit__cap-seam" x="8" y="15" width="16" height="2.2" rx="1.1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="dtp__body">
              <div className="mcal">
                <div className="mcal__head">
                  <div className="mcal__title">
                    {`${vy} 年 ${vm + 1} 月`}
                    <small>{yrs ? `${yrs} 年后` : "今年"}</small>
                  </div>
                  <button
                    className="mcal__nav"
                    type="button"
                    aria-label="上个月"
                    disabled={new Date(vy, vm, 0) < lo}
                    onClick={() => setView(new Date(vy, vm - 1, 1))}
                  >
                    <Icon name="chev-left" />
                  </button>
                  <button
                    className="mcal__nav"
                    type="button"
                    aria-label="下个月"
                    disabled={new Date(vy, vm + 1, 1) > hi}
                    onClick={() => setView(new Date(vy, vm + 1, 1))}
                  >
                    <Icon name="chev-right" />
                  </button>
                </div>
                <div className="mcal__dow">
                  {DOW.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div ref={grid} className="mcal__grid" role="grid" aria-label="日期" onKeyDown={onGridKey}>
                  {cells.map(({ c, sel, key }) => {
                    const cls = ["mcal__d"];
                    if (c.getMonth() !== vm) cls.push("is-out");
                    if (sameDay(c, today)) cls.push("is-today");
                    if (c > t0 && c < s0) cls.push("is-span");
                    if (sel) cls.push("is-sel");
                    return (
                      <button
                        key={key}
                        type="button"
                        role="gridcell"
                        className={cls.join(" ")}
                        disabled={c < lo || c > hi}
                        tabIndex={sel ? 0 : -1}
                        aria-selected={sel}
                        aria-label={`${c.getFullYear()}年${c.getMonth() + 1}月${c.getDate()}日`}
                        onClick={() => pick(new Date(c.getFullYear(), c.getMonth(), c.getDate(), new Date(cur.current).getHours(), new Date(cur.current).getMinutes()).getTime(), true)}
                      >
                        {c.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`clock ${isDay ? "is-day" : "is-night"}`} data-mode={mode}>
                <div className="clock__read">
                  <div className="clock__seg">
                    <button type="button" className={mode === "h" ? "is-on" : undefined} aria-label="调小时" onClick={() => setMode("h")}>
                      {pad2(h)}
                    </button>
                    <i>:</i>
                    <button type="button" className={mode === "m" ? "is-on" : undefined} aria-label="调分钟" onClick={() => setMode("m")}>
                      {pad2(m)}
                    </button>
                  </div>
                  <div className="ampm">
                    <button type="button" className={h < 12 ? "is-on" : undefined} onClick={() => setAmPm("am")}>
                      <Icon name="sun" />
                      上午
                    </button>
                    <button type="button" className={h >= 12 ? "is-on" : undefined} onClick={() => setAmPm("pm")}>
                      <Icon name="moon" />
                      下午
                    </button>
                  </div>
                </div>
                <div className="clock__case">
                  <i className="clock__crown" aria-hidden="true" />
                  <svg
                    ref={dial}
                    className={`clock__dial${dragging.dial ? " is-drag" : ""}`}
                    viewBox="-12 -12 244 244"
                    tabIndex={0}
                    role="slider"
                    aria-label="表盘：拖动指针调整时刻"
                    aria-valuetext={`${h} 点 ${m} 分`}
                    onPointerDown={onDialDown}
                    onPointerMove={onDialMove}
                    onPointerUp={endDial}
                    onPointerCancel={endDial}
                    onKeyDown={onDialKey}
                  >
                    <defs>
                      {/* amber-dtp-hand 的 id 被 spec 样式（.clock__hand--h line）按名字引用，不能改 */}
                      <linearGradient id="amber-dtp-hand" gradientUnits="userSpaceOnUse" x1="110" y1="118" x2="110" y2="58">
                        <stop className="clock__g-hand-a" offset="0" />
                        <stop className="clock__g-hand-b" offset="1" />
                      </linearGradient>
                      <radialGradient id="amber-dtp-day" cx=".5" cy=".78" r=".75">
                        <stop className="clock__g-day" offset="0" stopOpacity=".35" />
                        <stop className="clock__g-day" offset="1" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="amber-dtp-night" cx=".5" cy=".3" r=".8">
                        <stop className="clock__g-night" offset="0" stopOpacity=".32" />
                        <stop className="clock__g-night" offset="1" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="amber-dtp-edge" cx=".5" cy=".5" r=".5">
                        <stop className="clock__g-edge" offset=".82" stopOpacity="0" />
                        <stop className="clock__g-edge" offset="1" stopOpacity=".22" />
                      </radialGradient>
                      <clipPath id="amber-dtp-face">
                        <circle cx="110" cy="110" r="110" />
                      </clipPath>
                    </defs>
                    <circle className="clock__face" cx="110" cy="110" r="110" />
                    <g clipPath="url(#amber-dtp-face)">
                      <g className="clock__sky clock__sky--day">
                        <rect width="220" height="220" fill="url(#amber-dtp-day)" />
                        <circle className="clock__sun" cx="110" cy="160" r="13" />
                        <circle className="clock__sun clock__sun--halo" cx="110" cy="160" r="22" />
                      </g>
                      <g className="clock__sky clock__sky--night">
                        <rect width="220" height="220" fill="url(#amber-dtp-night)" />
                        <path className="clock__moon" d="M118 150a12 12 0 1 1-12.5-14 9.5 9.5 0 0 0 12.5 14Z" />
                        <g className="clock__stars">
                          <circle cx="72" cy="68" r="1.2" opacity=".8" />
                          <circle cx="150" cy="62" r="1" opacity=".6" />
                          <circle cx="160" cy="140" r="1.4" opacity=".7" />
                          <circle cx="58" cy="132" r="1" opacity=".5" />
                          <circle cx="132" cy="172" r=".9" opacity=".6" />
                          <circle cx="84" cy="172" r="1.1" opacity=".5" />
                        </g>
                      </g>
                    </g>
                    <circle className="clock__vignette" cx="110" cy="110" r="110" fill="url(#amber-dtp-edge)" />
                    <circle className="clock__rehaut" cx="110" cy="110" r="102" />
                    <g>{DIAL_TICKS}</g>
                    <g>{DIAL_NUMS}</g>
                    <g>{DIAL_BEZEL}</g>
                    <text className="clock__brand" x="110" y="64">
                      HELLOTIME
                    </text>
                    <text className="clock__brand clock__brand--sub" x="110" y="74">
                      Automatic · Sealed
                    </text>
                    <g className="clock__date">
                      <rect x="163" y="101" width="24" height="18" rx="3" />
                      <text x="175" y="110.5">
                        {d.getDate()}
                      </text>
                    </g>
                    <g className="clock__hand clock__hand--h" style={{ transform: `rotate(${angH.current}deg)` }}>
                      <line x1="110" y1="118" x2="110" y2="58" />
                    </g>
                    <g className="clock__hand clock__hand--m" style={{ transform: `rotate(${angM.current}deg)` }}>
                      <line x1="110" y1="124" x2="110" y2="44" />
                      <circle className="knob" cx="110" cy="44" r="4.5" />
                    </g>
                    <circle className="clock__pin" cx="110" cy="110" r="6" />
                    <path className="clock__glass" d="M30 92C40 52 74 26 116 22c-36 14-62 40-74 78-4 2-9 0-12-8Z" />
                  </svg>
                </div>
                <div className="clock__hint">{mode === "h" ? "拖动时针，松手后自动切到分针" : "拖动分针，越过 12 点会自动进退一小时"}</div>
              </div>
            </div>

            <div className="dtp__foot">
              <div className="dtp__eta">
                胶囊将在{" "}
                {eta(value).map((p, i) => (
                  <Fragment key={p.u}>
                    {i ? " " : null}
                    <b>{p.n}</b>
                    {p.u}
                  </Fragment>
                ))}{" "}
                后开启
                {clamped ? <small className="is-warn">{`已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${tz}`}</small> : <small>{`按你所在的时区 ${tz} 计时`}</small>}
              </div>
              <button className="btn btn--primary btn--sm" type="button" onClick={closeAndFocus}>
                就这一刻
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
