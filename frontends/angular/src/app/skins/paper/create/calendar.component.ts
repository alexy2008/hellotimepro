// ============================================================
// 日历：精确到分钟。选中的那天被朱笔圈出（换了日子时重画一遍）。
// 底部的时 / 分输入自己持有正在敲的字，失焦或回车才提交（父组件每秒重绘也不会丢焦点）
// ============================================================

import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { clamp, fmt, pad2 } from '@/lib/fmt';
import { LIMITS } from '@/lib/schedule';
import { IconDirective } from '@/shared/icon.directive';
import { KeyDirective } from '@/shared/key.directive';

@Component({
  selector: 'input[appPaperTimeInput]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cal__t mono',
    inputmode: 'numeric',
    maxlength: '2',
    '[attr.aria-label]': "which() === 'h' ? '小时' : '分钟'",
    '[value]': 'text()',
    '(input)': 'text.set($any($event.target).value)',
    '(blur)': 'commit.emit(text())',
    '(keydown)': 'onKey($event)',
  },
  template: '',
})
export class PaperTimeInputComponent {
  readonly which = input.required<'h' | 'm'>();
  readonly openAt = input.required<number>();
  readonly commit = output<string>();
  protected readonly text = signal('');

  constructor() {
    effect(() => {
      const d = new Date(this.openAt());
      const v = pad2(this.which() === 'h' ? d.getHours() : d.getMinutes());
      untracked(() => this.text.set(v));
    });
  }

  protected onKey(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter') this.commit.emit(el.value);
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const max = this.which() === 'h' ? 24 : 60;
    const step = (e.key === 'ArrowUp' ? 1 : -1) * (this.which() === 'h' ? 1 : 5);
    this.commit.emit(String(((parseInt(el.value, 10) || 0) + step + max) % max));
  }
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

@Component({
  selector: 'div[appPaperCalendar]',
  imports: [IconDirective, KeyDirective, PaperTimeInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal' },
  template: `
    @let y = month().getFullYear();
    @let mo = month().getMonth();
    <div class="cal__head">
      <button class="cal__nav" type="button" aria-label="上一年" [disabled]="navDisabled().prevYear" (click)="nav(-12)">«</button>
      <button class="cal__nav" type="button" aria-label="上个月" [disabled]="navDisabled().prevMonth" (click)="nav(-1)">‹</button>
      <div class="cal__title serif"><b class="latin">{{ y }}</b> 年 <b class="latin">{{ mo + 1 }}</b> 月</div>
      <button class="cal__nav" type="button" aria-label="下个月" [disabled]="navDisabled().nextMonth" (click)="nav(1)">›</button>
      <button class="cal__nav" type="button" aria-label="下一年" [disabled]="navDisabled().nextYear" (click)="nav(12)">»</button>
    </div>
    <div class="cal__dow">
      @for (w of week; track w) {
        <span>{{ w }}</span>
      }
    </div>
    <div class="cal__grid">
      @for (it of days(); track $index) {
        <button
          type="button"
          class="cal__d"
          [class.is-out]="it.out"
          [class.is-today]="it.today"
          [class.is-sel]="it.sel"
          [disabled]="it.dis"
          [attr.aria-label]="it.label"
          [attr.aria-current]="it.sel ? 'date' : null"
          (click)="pickDay(it.d)"
        >
          {{ it.d.getDate() }}
          @if (it.sel) {
            <svg *appKey="selKey()" class="cal__ring is-draw" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6" />
            </svg>
          }
        </button>
      }
    </div>
    <div class="cal__time">
      <span class="cal__time-k"><svg appIcon="clock"></svg>时刻</span>
      <input appPaperTimeInput which="h" [openAt]="openAt()" (commit)="commitTime('h', $event)" />
      <i>:</i>
      <input appPaperTimeInput which="m" [openAt]="openAt()" (commit)="commitTime('m', $event)" />
      <span class="cal__tz mono">{{ tz }}</span>
    </div>
  `,
})
export class PaperCalendarComponent {
  readonly openAt = input.required<number>();
  readonly pick = output<number>();

  protected readonly week = ['一', '二', '三', '四', '五', '六', '日'];
  protected readonly tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区';
  private readonly sel = computed(() => new Date(this.openAt()));
  protected readonly month = signal(new Date());
  protected readonly selKey = computed(() => `${this.sel().getFullYear()}-${this.sel().getMonth()}-${this.sel().getDate()}`);

  private readonly lo = computed(() => {
    const d = new Date(LIMITS.minOpen() + 30_000);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  private readonly hi = computed(() => {
    const d = new Date(LIMITS.maxOpen());
    d.setHours(23, 59, 59, 999);
    return d;
  });
  protected readonly navDisabled = computed(() => {
    const y = this.month().getFullYear();
    const mo = this.month().getMonth();
    return {
      prevYear: new Date(y - 1, mo + 1, 0) < this.lo(),
      prevMonth: new Date(y, mo, 0) < this.lo(),
      nextMonth: new Date(y, mo + 1, 1) > this.hi(),
      nextYear: new Date(y + 1, mo, 1) > this.hi(),
    };
  });
  protected readonly days = computed(() => {
    const y = this.month().getFullYear();
    const mo = this.month().getMonth();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const today = new Date();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(y, mo, 1 - lead + i);
      return {
        d,
        label: fmt.cn(d.getTime()),
        out: d.getMonth() !== mo,
        dis: d < this.lo() || d > this.hi(),
        today: sameDay(d, today),
        sel: sameDay(d, this.sel()),
      };
    });
  });

  constructor() {
    // 外部（预设 / 标尺）改了日子，翻到那个月
    effect(() => {
      const s = this.sel();
      const y = s.getFullYear();
      const m = s.getMonth();
      untracked(() => this.month.set(new Date(y, m, 1)));
    });
  }

  protected nav(n: number) {
    this.month.update((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  }

  protected pickDay(d: Date) {
    const cur = new Date(this.openAt());
    const t = new Date(d);
    t.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
    this.pick.emit(t.getTime());
  }

  protected commitTime(which: 'h' | 'm', raw: string) {
    const cur = new Date(this.openAt());
    const n = clamp(parseInt(raw, 10) || 0, 0, which === 'h' ? 23 : 59);
    if (which === 'h') cur.setHours(n);
    else cur.setMinutes(n);
    this.pick.emit(cur.getTime());
  }
}
