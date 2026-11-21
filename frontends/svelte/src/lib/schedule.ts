// ============================================================
// 开启时间：上下限、预设与校验文案（文案以 spec/ui/copy.md 为准）
// ============================================================

import { addCalendarYears } from "@/lib/fmt";

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/**
 * 开启时间上下限：晚于此刻 + 61 秒；不晚于「此刻往后 10 个日历年」（openapi 2.0.0，与服务端同一算法），
 * 两头各留一点余量，避免与服务端的时钟、时区差撞线
 */
export const LIMITS = {
  minOpen: () => Date.now() + 61 * 1000,
  maxOpen: () => addCalendarYears(Date.now(), 10) - 5 * 60 * 1000,
};

export const MSG = {
  title: "先给这枚胶囊起个标题",
  content: "还没写内容呢，写点什么吧",
  openMin: "开启时间至少要在 1 分钟之后",
  openMax: "开启时间不能超过 10 年",
};

const atNine = (d: Date) => {
  d.setHours(9, 0, 0, 0);
  return d.getTime();
};
const plus = (fn: (d: Date) => void) => () => {
  const d = new Date();
  fn(d);
  return atNine(d);
};

/** 开启时间预设：key 是测试钩子 openat-preset 的 data-value（spec/ui/testids.md） */
export const PRESET_AT: Record<string, () => number> = {
  "1m": () => Date.now() + 125 * 1000,
  tm: plus((d) => d.setDate(d.getDate() + 1)),
  "1w": plus((d) => d.setDate(d.getDate() + 7)),
  "1mo": plus((d) => d.setMonth(d.getMonth() + 1)),
  "1y": plus((d) => d.setFullYear(d.getFullYear() + 1)),
  "5y": plus((d) => d.setFullYear(d.getFullYear() + 5)),
  "10y": plus((d) => {
    d.setFullYear(d.getFullYear() + 10);
    d.setDate(d.getDate() - 1);
  }),
};
