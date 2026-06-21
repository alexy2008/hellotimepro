"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { pad2 } from "@/lib/format";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

type Preset = "1m" | "1h" | "tomorrow9" | "1y" | "y2030";
type ManualField = "year" | "month" | "day" | "hour" | "minute";

interface ManualParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

interface DateTimePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

function parseLocal(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date();
  fallback.setSeconds(0, 0);
  return fallback;
}

function toLocalValue(date: Date): string {
  return [
    date.getFullYear(),
    "-",
    pad2(date.getMonth() + 1),
    "-",
    pad2(date.getDate()),
    "T",
    pad2(date.getHours()),
    ":",
    pad2(date.getMinutes()),
  ].join("");
}

function toManualParts(date: Date): ManualParts {
  return {
    year: String(date.getFullYear()),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
    hour: pad2(date.getHours()),
    minute: pad2(date.getMinutes()),
  };
}

function formatDisplay(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDistance(date: Date): string {
  const diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);
  if (diffMinutes <= 0) return "已到开启时刻";
  if (diffMinutes < 60) return `距开启 ${diffMinutes} 分钟`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return `距开启 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days < 365) return `距开启 ${days} 天${restHours ? ` ${restHours} 小时` : ""}`;
  const years = Math.floor(days / 365);
  const restDays = days % 365;
  return `距开启 ${years} 年${restDays ? ` ${restDays} 天` : ""}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayFromMonday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function sameDay(a: Date, year: number, month: number, day: number): boolean {
  return a.getFullYear() === year && a.getMonth() === month && a.getDate() === day;
}

function todayMatches(year: number, month: number, day: number): boolean {
  return sameDay(new Date(), year, month, day);
}

function withPreset(spec: Preset): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  switch (spec) {
    case "1m":
      next.setMinutes(next.getMinutes() + 2);
      return next;
    case "1h":
      next.setHours(next.getHours() + 1);
      return next;
    case "tomorrow9":
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next;
    case "1y":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    case "y2030":
      return new Date(2030, 0, 1, 0, 0, 0, 0);
  }
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function onlyDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function num(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function DateTimePicker({ id, value, onChange }: DateTimePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const valueDate = useMemo(() => parseLocal(value), [value]);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const [maxHeight, setMaxHeight] = useState(460);
  const [draft, setDraft] = useState(valueDate);
  const [manualParts, setManualParts] = useState(() => toManualParts(valueDate));
  const [viewMonth, setViewMonth] = useState(() => new Date(valueDate.getFullYear(), valueDate.getMonth(), 1));

  useEffect(() => {
    if (!open) {
      setDraft(valueDate);
      setViewMonth(new Date(valueDate.getFullYear(), valueDate.getMonth(), 1));
    }
  }, [open, valueDate]);

  useEffect(() => {
    setManualParts(toManualParts(draft));
  }, [draft]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePlacement() {
      const root = rootRef.current;
      const popover = popoverRef.current;
      if (!root || !popover) return;

      const gap = 8;
      const rect = root.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const popoverHeight = popover.offsetHeight;
      const nextPlacement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "above" : "below";
      const availableSpace = nextPlacement === "above" ? spaceAbove : spaceBelow;
      setPlacement(nextPlacement);
      setMaxHeight(Math.max(160, Math.min(460, Math.floor(availableSpace))));
    }

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const leadingBlanks = firstWeekdayFromMonday(year, month);
  const totalDays = daysInMonth(year, month);
  const popoverStyle = { "--cy-dtp-max-height": `${maxHeight}px` } as CSSProperties;

  function pickDay(day: number) {
    const next = new Date(draft);
    next.setFullYear(year, month, day);
    setDraft(next);
  }

  function setHour(hour: number) {
    const next = new Date(draft);
    next.setHours(hour);
    setDraft(next);
  }

  function setMinute(minute: number) {
    const next = new Date(draft);
    next.setMinutes(minute);
    setDraft(next);
  }

  function tryCommitManual(parts: ManualParts) {
    if (parts.year.length !== 4 || !parts.month || !parts.day || !parts.hour || !parts.minute) return;
    const y = num(parts.year);
    const m = num(parts.month);
    const d = num(parts.day);
    const h = num(parts.hour);
    const min = num(parts.minute);
    if (y === null || m === null || d === null || h === null || min === null) return;
    if (y < 1 || m < 1 || m > 12 || h < 0 || h > 23 || min < 0 || min > 59) return;
    const maxDay = daysInMonth(y, m - 1);
    if (d < 1 || d > maxDay) return;
    const next = new Date(y, m - 1, d, h, min, 0, 0);
    setDraft(next);
    setViewMonth(new Date(y, m - 1, 1));
  }

  function setManualPart(field: ManualField, rawValue: string) {
    const maxLength = field === "year" ? 4 : 2;
    const nextParts = { ...manualParts, [field]: onlyDigits(rawValue, maxLength) };
    setManualParts(nextParts);
    tryCommitManual(nextParts);
  }

  function adjustManualPart(field: ManualField, delta: number) {
    let next = new Date(draft);
    if (field === "year") {
      const y = clamp(draft.getFullYear() + delta, 1, 9999);
      next = new Date(y, draft.getMonth(), Math.min(draft.getDate(), daysInMonth(y, draft.getMonth())), draft.getHours(), draft.getMinutes(), 0, 0);
    } else if (field === "month") {
      const monthBase = new Date(draft.getFullYear(), draft.getMonth() + delta, 1);
      next = new Date(
        monthBase.getFullYear(),
        monthBase.getMonth(),
        Math.min(draft.getDate(), daysInMonth(monthBase.getFullYear(), monthBase.getMonth())),
        draft.getHours(),
        draft.getMinutes(),
        0,
        0,
      );
    } else if (field === "day") {
      next.setDate(next.getDate() + delta);
    } else if (field === "hour") {
      next.setHours(next.getHours() + delta);
    } else {
      next.setMinutes(next.getMinutes() + delta);
    }
    setDraft(next);
    setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function handleManualKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, field: ManualField) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    adjustManualPart(field, event.key === "ArrowUp" ? 1 : -1);
  }

  function normalizeManualParts() {
    const y = num(manualParts.year) ?? draft.getFullYear();
    const safeYear = Math.min(9999, Math.max(1, y));
    const m = Math.min(12, Math.max(1, num(manualParts.month) ?? draft.getMonth() + 1));
    const maxDay = daysInMonth(safeYear, m - 1);
    const d = Math.min(maxDay, Math.max(1, num(manualParts.day) ?? draft.getDate()));
    const h = Math.min(23, Math.max(0, num(manualParts.hour) ?? draft.getHours()));
    const min = Math.min(59, Math.max(0, num(manualParts.minute) ?? draft.getMinutes()));
    const next = new Date(safeYear, m - 1, d, h, min, 0, 0);
    setDraft(next);
    setViewMonth(new Date(safeYear, m - 1, 1));
  }

  function applyPreset(spec: Preset) {
    const next = withPreset(spec);
    setDraft(next);
    setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function confirm() {
    onChange(toLocalValue(draft));
    setOpen(false);
  }

  return (
    <div className="cy-dtp" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="cy-dtp__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="cy-dtp__trigger-icon" aria-hidden="true">⏱</span>
        <span className="cy-dtp__trigger-main">
          <span className="cy-dtp__trigger-value">
            {formatDisplay(valueDate)}
            <span className="cy-dtp__trigger-hint">{formatDistance(valueDate)}</span>
          </span>
        </span>
        <span className="cy-dtp__trigger-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={`cy-dtp__popover cy-dtp__popover--${placement}`}
          style={popoverStyle}
          role="dialog"
          aria-labelledby={`${id}_title`}
        >
          <div className="cy-dtp__topbar">
            <div className="cy-dtp__summary">
              <span id={`${id}_title`} className="cy-dtp__eyebrow">选择开启时刻</span>
              <strong>{formatDistance(draft)}</strong>
            </div>
            <div className="cy-dtp__manual" aria-label="手动输入开启时间">
              <input
                aria-label="年份"
                inputMode="numeric"
                value={manualParts.year}
                onBlur={normalizeManualParts}
                onKeyDown={(e) => handleManualKeyDown(e, "year")}
                onChange={(e) => setManualPart("year", e.target.value)}
              />
              <span>年</span>
              <input
                aria-label="月份"
                inputMode="numeric"
                value={manualParts.month}
                onBlur={normalizeManualParts}
                onKeyDown={(e) => handleManualKeyDown(e, "month")}
                onChange={(e) => setManualPart("month", e.target.value)}
              />
              <span>月</span>
              <input
                aria-label="日期"
                inputMode="numeric"
                value={manualParts.day}
                onBlur={normalizeManualParts}
                onKeyDown={(e) => handleManualKeyDown(e, "day")}
                onChange={(e) => setManualPart("day", e.target.value)}
              />
              <span>日</span>
              <input
                aria-label="小时"
                inputMode="numeric"
                value={manualParts.hour}
                onBlur={normalizeManualParts}
                onKeyDown={(e) => handleManualKeyDown(e, "hour")}
                onChange={(e) => setManualPart("hour", e.target.value)}
              />
              <span>:</span>
              <input
                aria-label="分钟"
                inputMode="numeric"
                value={manualParts.minute}
                onBlur={normalizeManualParts}
                onKeyDown={(e) => handleManualKeyDown(e, "minute")}
                onChange={(e) => setManualPart("minute", e.target.value)}
              />
            </div>
            <div className="cy-dtp__actions">
              <button type="button" className="cy-btn cy-btn--ghost cy-btn--sm" onClick={() => setOpen(false)}>取消</button>
              <button type="button" className="cy-btn cy-btn--primary cy-btn--sm" onClick={confirm}>确认</button>
            </div>
          </div>

          <div className="cy-dtp__panel">
            <div className="cy-dtp__calendar">
              <div className="cy-dtp__monthbar">
                <button type="button" aria-label="上个月" onClick={() => setViewMonth((cur) => addMonths(cur, -1))}>‹</button>
                <strong>{year}年{month + 1}月</strong>
                <button type="button" aria-label="下个月" onClick={() => setViewMonth((cur) => addMonths(cur, 1))}>›</button>
              </div>

              <div className="cy-dtp__weekdays">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>

              <div className="cy-dtp__days">
                {Array.from({ length: leadingBlanks }).map((_, index) => (
                  <span key={`blank-${index}`} aria-hidden="true" />
                ))}
                {Array.from({ length: totalDays }).map((_, index) => {
                  const day = index + 1;
                  const selected = sameDay(draft, year, month, day);
                  const isToday = todayMatches(year, month, day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`${selected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`.trim()}
                      aria-pressed={selected}
                      onClick={() => pickDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="cy-dtp__time">
              <label>
                小时
                <select className="cy-select" value={draft.getHours()} onChange={(e) => setHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <option key={hour} value={hour}>{pad2(hour)}</option>
                  ))}
                </select>
              </label>
              <label>
                分钟
                <select className="cy-select" value={draft.getMinutes()} onChange={(e) => setMinute(Number(e.target.value))}>
                  {Array.from({ length: 12 }).map((_, index) => {
                    const minute = index * 5;
                    return <option key={minute} value={minute}>{pad2(minute)}</option>;
                  })}
                </select>
              </label>
              <div
                className="cy-dtp__clock"
                aria-label="标准时钟表盘"
                style={
                  {
                    "--cy-dtp-clock-hour-angle": `${(draft.getHours() % 12) * 30 + draft.getMinutes() * 0.5}deg`,
                    "--cy-dtp-clock-minute-angle": `${draft.getMinutes() * 6}deg`,
                  } as CSSProperties
                }
              >
                <span className="cy-dtp__clock-hand cy-dtp__clock-hand--hour" aria-hidden="true" />
                <span className="cy-dtp__clock-hand cy-dtp__clock-hand--minute" aria-hidden="true" />
                <span className="cy-dtp__clock-center" aria-hidden="true" />
                {Array.from({ length: 12 }).map((_, index) => {
                  const hour = index === 0 ? 12 : index;
                  const angle = index * 30;
                  return (
                    <span
                      key={hour}
                      className={draft.getHours() % 12 === hour % 12 ? "is-active" : ""}
                      aria-label={`${hour} 点`}
                      style={{ transform: `rotate(${angle}deg) translateY(-38px) rotate(${-angle}deg)` }}
                    >
                      {hour}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="cy-dtp__presets" aria-label="快速预设">
            <button type="button" onClick={() => applyPreset("1m")}>1分钟后</button>
            <button type="button" onClick={() => applyPreset("1h")}>1小时后</button>
            <button type="button" onClick={() => applyPreset("tomorrow9")}>明天9:00</button>
            <button type="button" onClick={() => applyPreset("1y")}>1年后</button>
            <button type="button" onClick={() => applyPreset("y2030")}>2030.01.01</button>
          </div>

        </div>
      )}
    </div>
  );
}
