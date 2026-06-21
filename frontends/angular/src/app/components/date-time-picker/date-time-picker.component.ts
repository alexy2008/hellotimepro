import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  type OnChanges,
} from '@angular/core';
import { pad2 } from '@/utils/format';

type Preset = '1m' | '1h' | 'tomorrow9' | '1y' | 'y2030';
type ManualField = 'year' | 'month' | 'day' | 'hour' | 'minute';

interface ManualParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

@Component({
  selector: 'app-date-time-picker',
  standalone: true,
  template: `
    <div class="cy-dtp" #rootRef>
      <button
        [id]="id"
        type="button"
        class="cy-dtp__trigger"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open"
        (click)="toggleOpen()"
      >
        <span class="cy-dtp__trigger-icon" aria-hidden="true">⏱</span>
        <span class="cy-dtp__trigger-main">
          <span class="cy-dtp__trigger-value">
            {{ formatDisplay(valueDate) }}
            <span class="cy-dtp__trigger-hint">{{ formatDistance(valueDate) }}</span>
          </span>
        </span>
        <span class="cy-dtp__trigger-chevron" aria-hidden="true">⌄</span>
      </button>

      @if (open) {
        <div
          #popoverRef
          class="cy-dtp__popover"
          [class.cy-dtp__popover--below]="placement === 'below'"
          [class.cy-dtp__popover--above]="placement === 'above'"
          [style.--cy-dtp-max-height]="maxHeight + 'px'"
          role="dialog"
          [attr.aria-labelledby]="id + '_title'"
        >
          <div class="cy-dtp__topbar">
            <div class="cy-dtp__summary">
              <span [id]="id + '_title'" class="cy-dtp__eyebrow">选择开启时刻</span>
              <strong>{{ formatDistance(draft) }}</strong>
            </div>
            <div class="cy-dtp__manual" aria-label="手动输入开启时间">
              <input aria-label="年份" inputmode="numeric" [value]="manualParts.year"
                (blur)="normalizeManualParts()" (keydown)="handleManualKeyDown($event, 'year')"
                (input)="setManualPart('year', eventValue($event))" />
              <span>年</span>
              <input aria-label="月份" inputmode="numeric" [value]="manualParts.month"
                (blur)="normalizeManualParts()" (keydown)="handleManualKeyDown($event, 'month')"
                (input)="setManualPart('month', eventValue($event))" />
              <span>月</span>
              <input aria-label="日期" inputmode="numeric" [value]="manualParts.day"
                (blur)="normalizeManualParts()" (keydown)="handleManualKeyDown($event, 'day')"
                (input)="setManualPart('day', eventValue($event))" />
              <span>日</span>
              <input aria-label="小时" inputmode="numeric" [value]="manualParts.hour"
                (blur)="normalizeManualParts()" (keydown)="handleManualKeyDown($event, 'hour')"
                (input)="setManualPart('hour', eventValue($event))" />
              <span>:</span>
              <input aria-label="分钟" inputmode="numeric" [value]="manualParts.minute"
                (blur)="normalizeManualParts()" (keydown)="handleManualKeyDown($event, 'minute')"
                (input)="setManualPart('minute', eventValue($event))" />
            </div>
            <div class="cy-dtp__actions">
              <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" (click)="open = false">取消</button>
              <button type="button" class="cy-btn cy-btn--primary cy-btn--sm" (click)="confirm()">确认</button>
            </div>
          </div>

          <div class="cy-dtp__panel">
            <div class="cy-dtp__calendar">
              <div class="cy-dtp__monthbar">
                <button type="button" aria-label="上个月" (click)="changeMonth(-1)">‹</button>
                <strong>{{ year }}年{{ month + 1 }}月</strong>
                <button type="button" aria-label="下个月" (click)="changeMonth(1)">›</button>
              </div>

              <div class="cy-dtp__weekdays">
                @for (weekday of weekdays; track weekday) {
                  <span>{{ weekday }}</span>
                }
              </div>

              <div class="cy-dtp__days">
                @for (_ of blanks; track $index) {
                  <span aria-hidden="true"></span>
                }
                @for (day of days; track day) {
                  <button
                    type="button"
                    [class.is-selected]="sameDay(draft, year, month, day)"
                    [class.is-today]="todayMatches(year, month, day)"
                    [attr.aria-pressed]="sameDay(draft, year, month, day)"
                    (click)="pickDay(day)"
                  >
                    {{ day }}
                  </button>
                }
              </div>
            </div>

            <div class="cy-dtp__time">
              <label>
                小时
                <select class="cy-select" [value]="draft.getHours()" (change)="setHour(eventNumber($event))">
                  @for (hour of hours; track hour) {
                    <option [value]="hour">{{ pad(hour) }}</option>
                  }
                </select>
              </label>
              <label>
                分钟
                <select class="cy-select" [value]="draft.getMinutes()" (change)="setMinute(eventNumber($event))">
                  @for (minute of minutes; track minute) {
                    <option [value]="minute">{{ pad(minute) }}</option>
                  }
                </select>
              </label>
              <div
                class="cy-dtp__clock"
                aria-label="标准时钟表盘"
                [style.--cy-dtp-clock-hour-angle]="clockHourAngle + 'deg'"
                [style.--cy-dtp-clock-minute-angle]="clockMinuteAngle + 'deg'"
              >
                <span class="cy-dtp__clock-hand cy-dtp__clock-hand--hour" aria-hidden="true"></span>
                <span class="cy-dtp__clock-hand cy-dtp__clock-hand--minute" aria-hidden="true"></span>
                <span class="cy-dtp__clock-center" aria-hidden="true"></span>
                @for (hour of clockHours; track hour) {
                  <span
                    [class.is-active]="draft.getHours() % 12 === hour % 12"
                    [attr.aria-label]="hour + ' 点'"
                    [style.transform]="clockNumberTransform(hour)"
                  >
                    {{ hour }}
                  </span>
                }
              </div>
            </div>
          </div>

          <div class="cy-dtp__presets" aria-label="快速预设">
            <button type="button" (click)="applyPreset('1m')">1分钟后</button>
            <button type="button" (click)="applyPreset('1h')">1小时后</button>
            <button type="button" (click)="applyPreset('tomorrow9')">明天9:00</button>
            <button type="button" (click)="applyPreset('1y')">1年后</button>
            <button type="button" (click)="applyPreset('y2030')">2030.01.01</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DateTimePickerComponent implements OnChanges {
  @Input({ required: true }) id = '';
  @Input({ required: true }) value = '';
  @Output() valueChange = new EventEmitter<string>();
  @ViewChild('rootRef') rootRef?: ElementRef<HTMLElement>;
  @ViewChild('popoverRef') popoverRef?: ElementRef<HTMLElement>;

  protected readonly weekdays = WEEKDAYS;
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  protected readonly clockHours = Array.from({ length: 12 }, (_, i) => i + 1);

  open = false;
  placement: 'below' | 'above' = 'below';
  maxHeight = 460;
  draft = this.parseLocal(this.value);
  manualParts = this.toManualParts(this.draft);
  viewMonth = new Date(this.draft.getFullYear(), this.draft.getMonth(), 1);

  ngOnChanges() {
    if (!this.open) this.syncFromValue();
  }

  get valueDate(): Date {
    return this.parseLocal(this.value);
  }

  get year(): number {
    return this.viewMonth.getFullYear();
  }

  get month(): number {
    return this.viewMonth.getMonth();
  }

  get blanks(): unknown[] {
    return Array.from({ length: this.firstWeekdayFromMonday(this.year, this.month) });
  }

  get days(): number[] {
    return Array.from({ length: this.daysInMonth(this.year, this.month) }, (_, i) => i + 1);
  }

  get clockHourAngle(): number {
    return (this.draft.getHours() % 12) * 30 + this.draft.getMinutes() * 0.5;
  }

  get clockMinuteAngle(): number {
    return this.draft.getMinutes() * 6;
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    if (this.open && !this.rootRef?.nativeElement.contains(event.target as Node)) this.open = false;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent) {
    if (this.open && event.key === 'Escape') this.open = false;
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportMove() {
    if (this.open) this.updatePlacement();
  }

  toggleOpen() {
    this.open = !this.open;
    if (this.open) {
      this.syncFromValue();
      window.setTimeout(() => this.updatePlacement());
    }
  }

  confirm() {
    this.valueChange.emit(this.toLocalValue(this.draft));
    this.open = false;
  }

  changeMonth(delta: number) {
    this.viewMonth = new Date(this.year, this.month + delta, 1);
  }

  pickDay(day: number) {
    const next = new Date(this.draft);
    next.setFullYear(this.year, this.month, day);
    this.setDraft(next);
  }

  setHour(hour: number) {
    const next = new Date(this.draft);
    next.setHours(hour);
    this.setDraft(next);
  }

  setMinute(minute: number) {
    const next = new Date(this.draft);
    next.setMinutes(minute);
    this.setDraft(next);
  }

  setManualPart(field: ManualField, rawValue: string) {
    const maxLength = field === 'year' ? 4 : 2;
    const nextParts = { ...this.manualParts, [field]: this.onlyDigits(rawValue, maxLength) };
    this.manualParts = nextParts;
    this.tryCommitManual(nextParts);
  }

  handleManualKeyDown(event: KeyboardEvent, field: ManualField) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.adjustManualPart(field, event.key === 'ArrowUp' ? 1 : -1);
  }

  normalizeManualParts() {
    const y = this.num(this.manualParts.year) ?? this.draft.getFullYear();
    const safeYear = Math.min(9999, Math.max(1, y));
    const m = Math.min(12, Math.max(1, this.num(this.manualParts.month) ?? this.draft.getMonth() + 1));
    const maxDay = this.daysInMonth(safeYear, m - 1);
    const d = Math.min(maxDay, Math.max(1, this.num(this.manualParts.day) ?? this.draft.getDate()));
    const h = Math.min(23, Math.max(0, this.num(this.manualParts.hour) ?? this.draft.getHours()));
    const min = Math.min(59, Math.max(0, this.num(this.manualParts.minute) ?? this.draft.getMinutes()));
    this.setDraft(new Date(safeYear, m - 1, d, h, min, 0, 0));
  }

  applyPreset(spec: Preset) {
    this.setDraft(this.withPreset(spec));
  }

  formatDisplay(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  formatDistance(date: Date): string {
    const diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);
    if (diffMinutes <= 0) return '已到开启时刻';
    if (diffMinutes < 60) return `距开启 ${diffMinutes} 分钟`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours < 24) return `距开启 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ''}`;
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    if (days < 365) return `距开启 ${days} 天${restHours ? ` ${restHours} 小时` : ''}`;
    const years = Math.floor(days / 365);
    const restDays = days % 365;
    return `距开启 ${years} 年${restDays ? ` ${restDays} 天` : ''}`;
  }

  sameDay(date: Date, year: number, month: number, day: number): boolean {
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  }

  todayMatches(year: number, month: number, day: number): boolean {
    return this.sameDay(new Date(), year, month, day);
  }

  eventValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  eventNumber(event: Event): number {
    const target = event.target;
    if (target instanceof HTMLSelectElement) return Number(target.value);
    return 0;
  }

  pad(value: number): string {
    return pad2(value);
  }

  clockNumberTransform(hour: number): string {
    return `rotate(${hour * 30}deg) translateY(-38px) rotate(${-hour * 30}deg)`;
  }

  private syncFromValue() {
    const next = this.parseLocal(this.value);
    this.draft = next;
    this.manualParts = this.toManualParts(next);
    this.viewMonth = new Date(next.getFullYear(), next.getMonth(), 1);
  }

  private updatePlacement() {
    if (!this.rootRef?.nativeElement || !this.popoverRef?.nativeElement) return;
    const gap = 8;
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const popoverHeight = this.popoverRef.nativeElement.offsetHeight;
    const nextPlacement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? 'above' : 'below';
    const availableSpace = nextPlacement === 'above' ? spaceAbove : spaceBelow;
    this.placement = nextPlacement;
    this.maxHeight = Math.max(160, Math.min(460, Math.floor(availableSpace)));
  }

  private setDraft(next: Date) {
    this.draft = next;
    this.manualParts = this.toManualParts(next);
    this.viewMonth = new Date(next.getFullYear(), next.getMonth(), 1);
  }

  private tryCommitManual(parts: ManualParts) {
    if (parts.year.length !== 4 || !parts.month || !parts.day || !parts.hour || !parts.minute) return;
    const y = this.num(parts.year);
    const m = this.num(parts.month);
    const d = this.num(parts.day);
    const h = this.num(parts.hour);
    const min = this.num(parts.minute);
    if (y === null || m === null || d === null || h === null || min === null) return;
    if (y < 1 || m < 1 || m > 12 || h < 0 || h > 23 || min < 0 || min > 59) return;
    const maxDay = this.daysInMonth(y, m - 1);
    if (d < 1 || d > maxDay) return;
    this.setDraft(new Date(y, m - 1, d, h, min, 0, 0));
  }

  private adjustManualPart(field: ManualField, delta: number) {
    let next = new Date(this.draft);
    if (field === 'year') {
      const y = this.clamp(this.draft.getFullYear() + delta, 1, 9999);
      next = new Date(y, this.draft.getMonth(), Math.min(this.draft.getDate(), this.daysInMonth(y, this.draft.getMonth())), this.draft.getHours(), this.draft.getMinutes(), 0, 0);
    } else if (field === 'month') {
      const monthBase = new Date(this.draft.getFullYear(), this.draft.getMonth() + delta, 1);
      next = new Date(
        monthBase.getFullYear(),
        monthBase.getMonth(),
        Math.min(this.draft.getDate(), this.daysInMonth(monthBase.getFullYear(), monthBase.getMonth())),
        this.draft.getHours(),
        this.draft.getMinutes(),
        0,
        0,
      );
    } else if (field === 'day') {
      next.setDate(next.getDate() + delta);
    } else if (field === 'hour') {
      next.setHours(next.getHours() + delta);
    } else {
      next.setMinutes(next.getMinutes() + delta);
    }
    this.setDraft(next);
  }

  private parseLocal(v: string): Date {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const fallback = new Date();
    fallback.setSeconds(0, 0);
    return fallback;
  }

  private toLocalValue(date: Date): string {
    return [
      date.getFullYear(),
      '-',
      pad2(date.getMonth() + 1),
      '-',
      pad2(date.getDate()),
      'T',
      pad2(date.getHours()),
      ':',
      pad2(date.getMinutes()),
    ].join('');
  }

  private toManualParts(date: Date): ManualParts {
    return {
      year: String(date.getFullYear()),
      month: pad2(date.getMonth() + 1),
      day: pad2(date.getDate()),
      hour: pad2(date.getHours()),
      minute: pad2(date.getMinutes()),
    };
  }

  private withPreset(spec: Preset): Date {
    const next = new Date();
    next.setSeconds(0, 0);
    switch (spec) {
      case '1m':
        next.setMinutes(next.getMinutes() + 2);
        return next;
      case '1h':
        next.setHours(next.getHours() + 1);
        return next;
      case 'tomorrow9':
        next.setDate(next.getDate() + 1);
        next.setHours(9, 0, 0, 0);
        return next;
      case '1y':
        next.setFullYear(next.getFullYear() + 1);
        return next;
      case 'y2030':
        return new Date(2030, 0, 1, 0, 0, 0, 0);
    }
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private firstWeekdayFromMonday(year: number, month: number): number {
    return (new Date(year, month, 1).getDay() + 6) % 7;
  }

  private onlyDigits(v: string, maxLength: number): string {
    return v.replace(/\D/g, '').slice(0, maxLength);
  }

  private num(v: string): number | null {
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }
}
