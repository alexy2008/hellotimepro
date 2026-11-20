// ============================================================
// 时间标尺：对数刻度，从「此刻」到「十年」。拖动 / 点按 / 方向键调整启封距离，
// 松手后对齐到取整后的时刻。外部（预设、日历、AI）改了时刻时平滑滑过去（is-glide）。
// 用法：<div appPaperTimeRuler [openAt]="…" [now]="…" (pick)="…"></div>
// ============================================================

import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { clamp, fmt, reducedMotion } from '@/lib/fmt';
import { DAY, HOUR, LIMITS, MIN } from '@/lib/schedule';

const ANCHORS = [
  { ms: 2 * MIN, label: '此刻' },
  { ms: HOUR, label: '1 小时' },
  { ms: DAY, label: '1 天' },
  { ms: 7 * DAY, label: '1 周' },
  { ms: 30 * DAY, label: '1 个月' },
  { ms: 182 * DAY, label: '半年' },
  { ms: 365 * DAY, label: '1 年' },
  { ms: 1096 * DAY, label: '3 年' },
  { ms: 1826 * DAY, label: '5 年' },
  { ms: 3651 * DAY, label: '10 年' },
];
const SEGS = ANCHORS.length - 1;
const SEG_W = 124;
const STRIP_W = SEGS * SEG_W;

const TICKS: Array<{ left: number; cls: string; label?: string }> = [];
for (let i = 0; i <= SEGS; i++) {
  TICKS.push({ left: i * SEG_W, cls: 'rt rt--major', label: ANCHORS[i].label });
  if (i < SEGS) for (let k = 1; k < 8; k++) TICKS.push({ left: i * SEG_W + (k * SEG_W) / 8, cls: k === 4 ? 'rt rt--mid' : 'rt' });
}

function vToMs(v: number) {
  const x = clamp(v, 0, 1) * SEGS;
  const i = Math.min(SEGS - 1, Math.floor(x));
  return ANCHORS[i].ms * Math.pow(ANCHORS[i + 1].ms / ANCHORS[i].ms, x - i);
}
function msToV(span: number) {
  const m = clamp(span, ANCHORS[0].ms, ANCHORS[SEGS].ms);
  for (let i = 0; i < SEGS; i++) {
    if (m <= ANCHORS[i + 1].ms) return (i + Math.log(m / ANCHORS[i].ms) / Math.log(ANCHORS[i + 1].ms / ANCHORS[i].ms)) / SEGS;
  }
  return 1;
}

/** 标尺拖出来的时长，按量级取整：越远越不需要精确到分钟 */
function roundOpen(span: number) {
  const d = new Date(Date.now() + span);
  if (span < HOUR) d.setSeconds(0, 0);
  else if (span < DAY) d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  else if (span < 30 * DAY) d.setMinutes(0, 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d.getTime();
}
const clampOpen = (t: number) => clamp(t, LIMITS.minOpen() + 30_000, LIMITS.maxOpen());

@Component({
  selector: 'div[appPaperTimeRuler]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ruler',
    '[class.is-drag]': 'drag()',
    '[class.is-glide]': 'glide()',
    tabindex: '0',
    role: 'slider',
    'aria-label': '启封距离：左右拖动或用方向键调整',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'valueNow()',
    '[attr.aria-valuetext]': 'valueText()',
    '(pointerdown)': 'onPointerDown($event)',
    '(keydown)': 'onKey($event)',
  },
  template: `
    <div class="ruler__strip" [style.transform]="strip()">
      @for (t of ticks; track $index) {
        <i [class]="t.cls" [style.left.px]="t.left">
          @if (t.label) {
            <b>{{ t.label }}</b>
          }
        </i>
      }
    </div>
    <div #needle class="ruler__needle"></div>
  `,
})
export class PaperTimeRulerComponent {
  readonly openAt = input.required<number>();
  readonly now = input.required<number>();
  readonly pick = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly needle = viewChild.required<ElementRef<HTMLElement>>('needle');
  protected readonly ticks = TICKS;
  protected readonly drag = signal(false);
  protected readonly glide = signal(false);
  /** 拖动中用拖出来的 v；松手后回到由时刻算出的位置 */
  private readonly dragV = signal<number | null>(null);
  private readonly v = computed(() => this.dragV() ?? msToV(this.openAt() - this.now()));
  protected readonly strip = computed(() => `translateX(${(-this.v() * STRIP_W).toFixed(1)}px)`);
  protected readonly valueNow = computed(() => Math.round(this.v() * 100));
  protected readonly valueText = computed(() => `${fmt.span(this.openAt() - this.now())}后，${fmt.full(this.openAt())}`);
  private lastPicked = NaN;
  private lastTick = -1;

  constructor() {
    // 外部（预设 / 日历 / AI）改了时刻：平滑滑过去
    let first = true;
    effect(() => {
      const t = this.openAt();
      untracked(() => {
        if (first) return void (first = false);
        if (t === this.lastPicked) return;
        this.dragV.set(null);
        this.glide.set(true);
      });
    });
  }

  private setFromV(nv: number) {
    this.dragV.set(clamp(nv, 0, 1));
    this.glide.set(false);
    this.lastPicked = clampOpen(roundOpen(vToMs(this.dragV()!)));
    this.pick.emit(this.lastPicked);
  }

  private tickFx(nv: number) {
    const idx = Math.round(nv * SEGS * 8);
    const el = this.needle().nativeElement;
    if (idx !== this.lastTick && el.animate && !reducedMotion()) {
      el.animate([{ transform: 'translateX(-50%) scaleY(1.14)' }, { transform: 'translateX(-50%) scaleY(1)' }], { duration: 150, easing: 'ease-out' });
    }
    this.lastTick = idx;
  }

  protected onPointerDown(e: PointerEvent) {
    if (e.button) return;
    const el = this.host;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const v0 = this.v();
    let moved = false;
    this.drag.set(true);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 3) moved = true;
      if (!moved) return;
      const nv = v0 - dx / STRIP_W;
      this.setFromV(nv);
      this.tickFx(nv);
    };
    const up = (ev: PointerEvent) => {
      this.drag.set(false);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved && ev.type === 'pointerup') {
        const r = el.getBoundingClientRect();
        this.setFromV(v0 + (ev.clientX - (r.left + r.width / 2)) / STRIP_W);
      }
      this.dragV.set(null); // 松手后对齐到取整后的时刻
      this.glide.set(true);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  protected onKey(e: KeyboardEvent) {
    const cur = this.v();
    const step = e.shiftKey ? 0.02 : 0.004;
    let nv: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nv = cur - step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nv = cur + step;
    else if (e.key === 'PageDown') nv = (Math.ceil(cur * SEGS - 0.001) - 1) / SEGS;
    else if (e.key === 'PageUp') nv = (Math.floor(cur * SEGS + 0.001) + 1) / SEGS;
    else if (e.key === 'Home') nv = 0;
    else if (e.key === 'End') nv = 1;
    if (nv == null) return;
    e.preventDefault();
    this.setFromV(nv);
    this.tickFx(nv);
    this.dragV.set(null);
  }
}
