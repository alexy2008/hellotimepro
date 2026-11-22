// ============================================================
// 「琥珀」开启时间选择器：星轨时钟
// 结构、类名与交互照 2.0 原型 assets/js/amber/datetime.js（样式在 spec/styles/amber/components.css），
// 行为对齐 React 版 skins/amber/DateTimePicker.tsx。
// - 触发条与输入框等宽；面板接在下方展开（不是浮层，不会被卡片裁掉），展开时滚进视口
// - 十年星轨：点年份穿越；拖动胶囊只换日子，时刻保留
// - 日历：方向键逐日 / 逐周，焦点跟着走；今天到选中日之间画「旅程线」
// - 昼夜表盘：先拖时针，松手切分针；分针越过 12 点进退一小时；指针角度累加不取模
// - 面板里的每次改动都夹进 LIMITS 的上下限再发出；外部（预设、AI 代笔、草稿恢复）改 value 时只同步显示
// 时间以 value（毫秒）为唯一数据源；组件自己只管展开、月份视图、表盘模式这类界面状态。
// 每秒的「此刻」来自全局节拍：只有读到它的绑定会更新，格子靠 track 复用，焦点与拖动不受影响。
// ============================================================

import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, type ElementRef, inject, Injector, input, type OnInit, output, signal, untracked, viewChild } from '@angular/core';
import { injectNow } from '@/core/clock';
import { clamp, pad2, reducedMotion } from '@/lib/fmt';
import { LIMITS } from '@/lib/schedule';
import { IconDirective } from '@/shared/icon.directive';
import { CONTENTS } from '@/shared/host';

const MIN = 60000;
const DAY = 86400000;
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DOW = ['一', '二', '三', '四', '五', '六', '日'];

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
  if (y) parts.push({ n: y, u: '年' });
  if (mo) parts.push({ n: mo, u: '个月' });
  if (d) parts.push({ n: d, u: '天' });
  parts.push({ n: h, u: '小时' }, { n: m, u: '分' });
  return parts;
}

/** 角度累加：59→0 时指针向前走一格，而不是倒转一整圈 */
const unwrap = (prev: number | null, next: number) => (prev == null ? next : prev + ((((next - prev) % 360) + 540) % 360) - 180);

// ---------------------------------------------------------------- 表盘的固定部分

const f2 = (n: number) => n.toFixed(2);
interface Tick {
  cls: string;
  x1: string;
  y1: string;
  x2: string;
  y2: string;
}
interface Bezel {
  k: 'lume' | 'n' | 'bar' | 'fine' | 'dot';
  rot: string;
  n: number;
}
const DIAL_TICKS: Tick[] = [];
const DIAL_BEZEL: Bezel[] = [];
for (let i = 0; i < 60; i++) {
  const a = (i * 6 * Math.PI) / 180;
  const five = i % 5 === 0;
  const r1 = five ? 92 : 96;
  DIAL_TICKS.push({
    cls: `clock__tick${five ? ' is-5' : ''}`,
    x1: f2(110 + r1 * Math.sin(a)),
    y1: f2(110 - r1 * Math.cos(a)),
    x2: f2(110 + 100 * Math.sin(a)),
    y2: f2(110 - 100 * Math.cos(a)),
  });
  // 刻度圈：0 点琥珀三角，10/20…50 数字，其余每 5 分一道短条，前 15 分钟逐分细刻
  const rot = `rotate(${i * 6} 110 110)`;
  const k: Bezel['k'] = i === 0 ? 'lume' : i % 10 === 0 ? 'n' : five ? 'bar' : i < 15 ? 'fine' : 'dot';
  DIAL_BEZEL.push({ k, rot, n: i });
}
const DIAL_NUMS: { cls: string; x: string; y: string; h: number }[] = [];
for (let h = 1; h <= 12; h++) {
  if (h === 3) continue; // 3 点位让给日历窗
  const a = (h * 30 * Math.PI) / 180;
  DIAL_NUMS.push({ cls: `clock__num${h % 3 === 0 ? ' is-q' : ''}`, x: f2(110 + 78 * Math.sin(a)), y: f2(110 - 78 * Math.cos(a)), h });
}
const NODE_IDX = Array.from({ length: 11 }, (_, i) => i);

interface Cell {
  key: string;
  y: number;
  m: number;
  d: number;
  cls: string;
  sel: boolean;
  off: boolean;
  label: string;
}

@Component({
  selector: 'app-amber-datetime-picker',
  imports: [IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let d = date();
    @let h = hour();
    @let m = minute();
    <div #root class="dtp" [class.is-open]="open()" (keydown)="onRootKey($event)">
      <button
        #trigger
        class="dtp__trigger"
        type="button"
        id="openAt"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        aria-controls="dtpPanel"
        aria-describedby="dtpVal"
        data-testid="create-openat"
        [attr.data-value]="iso()"
        (click)="setOpen(!open())"
      >
        <svg appIcon="calendar" class="ic--cal"></svg>
        <span class="dtp__val" id="dtpVal">
          <span class="dtp__date">{{ d.getFullYear() }} 年 {{ d.getMonth() + 1 }} 月 {{ d.getDate() }} 日</span>
          <span class="dtp__wd">{{ weekday() }}</span>
          <span class="dtp__time">{{ hhmm() }}</span>
        </span>
        <span class="dtp__rel">{{ relText() }}</span>
        <svg appIcon="chev-down" class="ic--chev"></svg>
      </button>
      <div class="dtp__panel" id="dtpPanel" role="dialog" aria-label="选择开启时间">
        <div class="dtp__clip">
          <div class="dtp__in">
            <div class="orbit">
              <div class="dtp__k">十年星轨<b>{{ railLabel() }}</b></div>
              <div
                #rail
                class="orbit__rail"
                [class.is-drag]="railDrag()"
                (pointerdown)="onRailDown($event)"
                (pointermove)="onRailMove($event)"
                (pointerup)="endRail()"
                (pointercancel)="endRail()"
              >
                <div class="orbit__line"></div>
                <div class="orbit__trail" [style.width]="railPct()"></div>
                <div>
                  @for (i of nodeIdx; track i) {
                    <button
                      class="orbit__node"
                      [class.is-past]="i > 0 && i / 10 <= frac() + 1e-6"
                      [class.is-cur]="thisYear() + i === d.getFullYear()"
                      type="button"
                      [style.left.%]="i * 10"
                      [attr.aria-label]="'穿越到 ' + (thisYear() + i) + ' 年'"
                      (click)="pickYear(i)"
                    >
                      <i></i>
                      <span>{{ i ? thisYear() + i : '今年' }}</span>
                    </button>
                  }
                </div>
                <div
                  class="orbit__cap"
                  [style.left]="railPct()"
                  tabindex="0"
                  role="slider"
                  aria-label="沿十年星轨拖动胶囊（方向键按月，PageUp / PageDown 按年）"
                  [attr.aria-valuetext]="d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月'"
                  (keydown)="onCapKey($event)"
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
                    {{ viewTitle() }}
                    <small>{{ viewYears() ? viewYears() + ' 年后' : '今年' }}</small>
                  </div>
                  <button class="mcal__nav" type="button" aria-label="上个月" [disabled]="prevDisabled()" (click)="shiftView(-1)"><svg appIcon="chev-left"></svg></button>
                  <button class="mcal__nav" type="button" aria-label="下个月" [disabled]="nextDisabled()" (click)="shiftView(1)"><svg appIcon="chev-right"></svg></button>
                </div>
                <div class="mcal__dow">
                  @for (w of dow; track w) {
                    <span>{{ w }}</span>
                  }
                </div>
                <div #grid class="mcal__grid" role="grid" aria-label="日期" (keydown)="onGridKey($event)">
                  @for (c of cells(); track c.key) {
                    <button
                      type="button"
                      role="gridcell"
                      [class]="c.cls"
                      [disabled]="c.off"
                      [attr.tabindex]="c.sel ? 0 : -1"
                      [attr.aria-selected]="c.sel"
                      [attr.aria-label]="c.label"
                      (click)="pickDay(c)"
                    >{{ c.d }}</button>
                  }
                </div>
              </div>

              <div class="clock" [class.is-day]="isDay()" [class.is-night]="!isDay()" [attr.data-mode]="mode()">
                <div class="clock__read">
                  <div class="clock__seg">
                    <button type="button" [class.is-on]="mode() === 'h'" aria-label="调小时" (click)="mode.set('h')">{{ pad(h) }}</button>
                    <i>:</i>
                    <button type="button" [class.is-on]="mode() === 'm'" aria-label="调分钟" (click)="mode.set('m')">{{ pad(m) }}</button>
                  </div>
                  <div class="ampm">
                    <button type="button" [class.is-on]="h < 12" (click)="setAmPm('am')"><svg appIcon="sun"></svg>上午</button>
                    <button type="button" [class.is-on]="h >= 12" (click)="setAmPm('pm')"><svg appIcon="moon"></svg>下午</button>
                  </div>
                </div>
                <div class="clock__case">
                  <i class="clock__crown" aria-hidden="true"></i>
                  <svg
                    #dial
                    class="clock__dial"
                    [class.is-drag]="dialDrag()"
                    viewBox="-12 -12 244 244"
                    tabindex="0"
                    role="slider"
                    aria-label="表盘：拖动指针调整时刻"
                    [attr.aria-valuetext]="h + ' 点 ' + m + ' 分'"
                    (pointerdown)="onDialDown($event)"
                    (pointermove)="onDialMove($event)"
                    (pointerup)="endDial()"
                    (pointercancel)="endDial()"
                    (keydown)="onDialKey($event)"
                  >
                    <defs>
                      <!-- amber-dtp-hand 的 id 被 spec 样式（.clock__hand--h line）按名字引用，不能改 -->
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
                      @for (t of ticks; track $index) {
                        <line [attr.class]="t.cls" [attr.x1]="t.x1" [attr.y1]="t.y1" [attr.x2]="t.x2" [attr.y2]="t.y2" />
                      }
                    </g>
                    <g>
                      @for (n of nums; track n.h) {
                        <text [attr.class]="n.cls" [attr.x]="n.x" [attr.y]="n.y">{{ n.h }}</text>
                      }
                    </g>
                    <g>
                      @for (b of bezel; track $index) {
                        @switch (b.k) {
                          @case ('lume') {
                            <path class="clock__lume" d="M106 -9h8L110 -3Z" />
                          }
                          @case ('n') {
                            <text class="clock__bz clock__bz-n" x="110" y="-5.5" [attr.transform]="b.rot">{{ b.n }}</text>
                          }
                          @case ('bar') {
                            <rect class="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" [attr.transform]="b.rot" />
                          }
                          @case ('fine') {
                            <rect class="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" [attr.transform]="b.rot" />
                          }
                          @default {
                            <circle class="clock__bz" cx="110" cy="-5.5" r=".7" [attr.transform]="b.rot" />
                          }
                        }
                      }
                    </g>
                    <text class="clock__brand" x="110" y="64">HELLOTIME</text>
                    <text class="clock__brand clock__brand--sub" x="110" y="74">Automatic · Sealed</text>
                    <g class="clock__date">
                      <rect x="163" y="101" width="24" height="18" rx="3" />
                      <text x="175" y="110.5">{{ d.getDate() }}</text>
                    </g>
                    <g class="clock__hand clock__hand--h" [style.transform]="'rotate(' + ang().h + 'deg)'">
                      <line x1="110" y1="118" x2="110" y2="58" />
                    </g>
                    <g class="clock__hand clock__hand--m" [style.transform]="'rotate(' + ang().m + 'deg)'">
                      <line x1="110" y1="124" x2="110" y2="44" />
                      <circle class="knob" cx="110" cy="44" r="4.5" />
                    </g>
                    <circle class="clock__pin" cx="110" cy="110" r="6" />
                    <path class="clock__glass" d="M30 92C40 52 74 26 116 22c-36 14-62 40-74 78-4 2-9 0-12-8Z" />
                  </svg>
                </div>
                <div class="clock__hint">{{ mode() === 'h' ? '拖动时针，松手后自动切到分针' : '拖动分针，越过 12 点会自动进退一小时' }}</div>
              </div>
            </div>

            <div class="dtp__foot">
              <div class="dtp__eta">
                胶囊将在&ngsp;@for (p of etaParts(); track p.u; let i = $index) {@if (i) {&ngsp;}<b>{{ p.n }}</b>{{ p.u }}}&ngsp;后开启
                @if (clamped()) {
                  <small class="is-warn">已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· {{ tz }}</small>
                } @else {
                  <small>按你所在的时区 {{ tz }} 计时</small>
                }
              </div>
              <button class="btn btn--primary btn--sm" type="button" (click)="closeAndFocus()">就这一刻</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AmberDateTimePickerComponent implements OnInit {
  /** 当前开启时间（毫秒） */
  readonly value = input.required<number>();
  /** 用户在面板里改动：已夹进上下限 */
  readonly valueChange = output<number>();

  protected readonly now = injectNow();
  private readonly injector = inject(Injector);

  protected readonly open = signal(false);
  protected readonly mode = signal<'h' | 'm'>('h');
  protected readonly view = signal(monthOf(Date.now()));
  protected readonly clamped = signal(false);
  protected readonly railDrag = signal(false);
  protected readonly dialDrag = signal(false);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly rail = viewChild.required<ElementRef<HTMLElement>>('rail');
  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly dial = viewChild.required<ElementRef<SVGSVGElement>>('dial');

  /** 最新的时刻：同一帧里连来的 pointermove 不会读到上一次渲染的旧值 */
  private cur = 0;
  /** 面板自己刚发出的值：回流到 value 时不当作「外部改动」 */
  private emitted: number | null = null;
  private angH: number | null = null;
  private angM: number | null = null;

  protected readonly ticks = DIAL_TICKS;
  protected readonly bezel = DIAL_BEZEL;
  protected readonly nums = DIAL_NUMS;
  protected readonly nodeIdx = NODE_IDX;
  protected readonly dow = DOW;
  protected readonly tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区';
  protected readonly pad = pad2;

  // ---- 派生值
  protected readonly date = computed(() => new Date(this.value()));
  protected readonly hour = computed(() => this.date().getHours());
  protected readonly minute = computed(() => this.date().getMinutes());
  protected readonly iso = computed(() => new Date(this.value()).toISOString());
  protected readonly weekday = computed(() => WD[this.date().getDay()]);
  protected readonly hhmm = computed(() => `${pad2(this.hour())}:${pad2(this.minute())}`);
  protected readonly isDay = computed(() => this.hour() >= 6 && this.hour() < 18);
  protected readonly relText = computed(() => rel(this.value(), this.now()));
  protected readonly etaParts = computed(() => eta(this.value(), this.now()));
  /** 指针角度：累加，59→0 不倒转（计算只随时刻变，不会被每秒的节拍重复执行） */
  protected readonly ang = computed(() => {
    const h = this.hour();
    const m = this.minute();
    this.angH = unwrap(this.angH, ((h % 12) + m / 60) * 30);
    this.angM = unwrap(this.angM, m * 6);
    return { h: this.angH, m: this.angM };
  });

  // 今天的零点与可选范围（按天取整，每秒重算也只在跨天时才变）
  private readonly todayMs = computed(() => dayStart(this.now()));
  private readonly loMs = computed(() => {
    this.now();
    return dayStart(LIMITS.minOpen());
  });
  private readonly hiMs = computed(() => {
    this.now();
    const d = new Date(LIMITS.maxOpen());
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  });
  protected readonly thisYear = computed(() => new Date(this.todayMs()).getFullYear());
  protected readonly frac = computed(() => {
    const now = this.now();
    return clamp((this.value() - now) / (LIMITS.maxOpen() - now), 0, 1);
  });
  protected readonly railPct = computed(() => `${(this.frac() * 100).toFixed(2)}%`);
  protected readonly railLabel = computed(() => `${(this.frac() * 10).toFixed(1)} / 10 年`);

  protected readonly viewTitle = computed(() => `${this.view().getFullYear()} 年 ${this.view().getMonth() + 1} 月`);
  protected readonly viewYears = computed(() => this.view().getFullYear() - this.thisYear());
  protected readonly prevDisabled = computed(() => new Date(this.view().getFullYear(), this.view().getMonth(), 0).getTime() < this.loMs());
  protected readonly nextDisabled = computed(() => new Date(this.view().getFullYear(), this.view().getMonth() + 1, 1).getTime() > this.hiMs());
  protected readonly cells = computed<Cell[]>(() => {
    const v = this.view();
    const vy = v.getFullYear();
    const vm = v.getMonth();
    const lo = this.loMs();
    const hi = this.hiMs();
    const t0 = this.todayMs();
    const sel = this.date();
    const s0 = dayStart(this.value());
    const lead = (new Date(vy, vm, 1).getDay() + 6) % 7;
    const today = new Date(t0);
    return Array.from({ length: 42 }, (_, i) => {
      const c = new Date(vy, vm, 1 - lead + i);
      const t = c.getTime();
      const isSel = sameDay(c, sel);
      const cls = ['mcal__d'];
      if (c.getMonth() !== vm) cls.push('is-out');
      if (sameDay(c, today)) cls.push('is-today');
      if (t > t0 && t < s0) cls.push('is-span');
      if (isSel) cls.push('is-sel');
      return {
        key: `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}`,
        y: c.getFullYear(),
        m: c.getMonth(),
        d: c.getDate(),
        cls: cls.join(' '),
        sel: isSel,
        off: t < lo || t > hi,
        label: `${c.getFullYear()}年${c.getMonth() + 1}月${c.getDate()}日`,
      };
    });
  });

  constructor() {
    // 外部（预设、AI 代笔、草稿恢复）改了时间：只同步月份视图与贴边提示，不发出
    effect(() => {
      const v = this.value();
      untracked(() => {
        this.cur = v;
        if (this.emitted === v) return void (this.emitted = null);
        this.emitted = null;
        this.view.set(monthOf(v));
        this.clamped.set(false);
      });
    });
    // 展开期间：点到组件和预设之外就收起；收起（或组件销毁）时清理 document 上的监听
    effect((onCleanup) => {
      if (!this.open()) return;
      const outside = (e: PointerEvent) => {
        const t = e.target as Element | null;
        if (t && !this.root().nativeElement.contains(t) && !t.closest('[data-preset]')) this.setOpen(false);
      };
      document.addEventListener('pointerdown', outside);
      onCleanup(() => document.removeEventListener('pointerdown', outside));
    });
  }

  ngOnInit() {
    this.cur = this.value();
    this.view.set(monthOf(this.cur));
  }

  /** 用户在面板里改动：夹进上下限 → 发出 */
  private pick(t: number, keepView = false) {
    const c = clamp(t, LIMITS.minOpen(), LIMITS.maxOpen());
    this.clamped.set(c !== t);
    this.emitted = c;
    this.cur = c;
    // 这一轮变更检测之后，value 的回流已经被认出来了：不留旧标记
    afterNextRender(() => (this.emitted = null), { injector: this.injector });
    if (!keepView) this.view.set(monthOf(c));
    this.valueChange.emit(c);
  }

  // ---- 开合
  protected setOpen(o: boolean) {
    this.open.set(o);
    if (!o) this.mode.set('h');
    else requestAnimationFrame(() => this.reveal());
  }

  /**
   * 展开时把整块面板滚进视口：和展开动画同时进行；
   * 向上滚的距离以「触发条不被顶部导航挡住」为限，底部避开手机底栏
   */
  private reveal() {
    const el = this.root().nativeElement;
    const trig = el.querySelector<HTMLElement>('.dtp__trigger');
    const inner = el.querySelector<HTMLElement>('.dtp__in');
    if (!trig || !inner) return;
    const top = trig.getBoundingClientRect().top;
    const need = top + trig.offsetHeight + inner.offsetHeight;
    const bar = document.querySelector<HTMLElement>('.tabbar');
    const barH = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().height : 0;
    const headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
    const over = need - (window.innerHeight - barH - 16);
    const dy = Math.min(over, top - headH - 16);
    if (dy > 0) window.scrollBy({ top: dy, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  protected closeAndFocus() {
    this.setOpen(false);
    this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected onRootKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.open()) {
      e.stopPropagation();
      this.closeAndFocus();
    }
  }

  // ---- 十年星轨
  private railTime(x: number) {
    const r = this.rail().nativeElement.getBoundingClientRect();
    const c = new Date(this.cur);
    const now = Date.now();
    const d = new Date(now + clamp((x - r.left) / r.width, 0, 1) * (LIMITS.maxOpen() - now));
    d.setHours(c.getHours(), c.getMinutes(), 0, 0); // 只换日子，时刻保留
    return d.getTime();
  }

  protected onRailDown(e: PointerEvent) {
    if ((e.target as Element).closest('.orbit__node')) return;
    this.railDrag.set(true);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    this.pick(this.railTime(e.clientX));
  }

  protected onRailMove(e: PointerEvent) {
    if (this.railDrag()) this.pick(this.railTime(e.clientX));
  }

  protected endRail() {
    this.railDrag.set(false);
  }

  protected pickYear(i: number) {
    this.pick(moveTo(this.cur, new Date().getFullYear() + i, new Date(this.cur).getMonth()));
  }

  protected onCapKey(e: KeyboardEvent) {
    const n = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
    const y = ({ PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key];
    if (!n && !y) return;
    e.preventDefault();
    this.pick(n ? addMonths(this.cur, n) : addYears(this.cur, y));
  }

  // ---- 日历
  protected shiftView(n: number) {
    const v = this.view();
    this.view.set(new Date(v.getFullYear(), v.getMonth() + n, 1));
  }

  protected pickDay(c: Cell) {
    const d = new Date(this.cur);
    this.pick(new Date(c.y, c.m, c.d, d.getHours(), d.getMinutes()).getTime(), true);
  }

  protected onGridKey(e: KeyboardEvent) {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    this.pick(this.cur + step * DAY);
    // 方向键换日之后，格子可能整页换了月：渲染完把焦点交还给选中的那格
    afterNextRender(() => this.grid().nativeElement.querySelector<HTMLElement>('.is-sel')?.focus(), { injector: this.injector });
  }

  // ---- 表盘
  private setHM(h: number, m: number) {
    const d = new Date(this.cur);
    d.setHours(h, m, 0, 0);
    this.pick(d.getTime());
  }

  protected setAmPm(ap: 'am' | 'pm') {
    const d = new Date(this.cur);
    const h = d.getHours();
    if (ap === 'am' && h >= 12) this.setHM(h - 12, d.getMinutes());
    if (ap === 'pm' && h < 12) this.setHM(h + 12, d.getMinutes());
  }

  private dialApply(e: PointerEvent) {
    const r = this.dial().nativeElement.getBoundingClientRect();
    const a = ((Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI + 360) % 360;
    const d = new Date(this.cur);
    const h = d.getHours();
    const m = d.getMinutes();
    if (this.mode() === 'h') return this.setHM((Math.round(a / 30) % 12) + (h >= 12 ? 12 : 0), m);
    const nm = Math.round(a / 6) % 60;
    this.setHM(m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h, nm); // 越过 12 点进退一小时
  }

  protected onDialDown(e: PointerEvent) {
    this.dialDrag.set(true);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件没有活动指针 */
    }
    this.dialApply(e);
  }

  protected onDialMove(e: PointerEvent) {
    if (this.dialDrag()) this.dialApply(e);
  }

  protected endDial() {
    if (!this.dialDrag()) return;
    this.dialDrag.set(false);
    if (this.mode() === 'h') this.mode.set('m');
  }

  protected onDialKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      return this.mode.set(this.mode() === 'h' ? 'm' : 'h');
    }
    const k = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key];
    if (!k) return;
    e.preventDefault();
    this.pick(this.cur + k * (this.mode() === 'h' ? 60 : 1) * MIN);
  }
}
