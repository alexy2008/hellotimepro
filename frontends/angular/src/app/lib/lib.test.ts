import { describe, expect, it } from "vitest";
import { addCalendarYears, fmt } from "./fmt";
import { BRAND_PALETTE, paletteOf } from "./palette";
import { safeRedirect } from "./redirect";

describe("fmt.cd", () => {
  it("把剩余时间拆成天时分秒", () => {
    const now = Date.UTC(2026, 3, 25);
    const cd = fmt.cd(now + ((1 * 24 + 1) * 3600 + 2 * 60 + 3) * 1000, now);
    expect(cd).toMatchObject({ expired: false, d: 1, h: 1, m: 2, s: 3 });
  });
  it("过去的时刻 expired=true、total=0", () => {
    const now = Date.now();
    expect(fmt.cd(now - 1000, now)).toMatchObject({ expired: true, total: 0 });
  });
});

describe("fmt.span", () => {
  it("把时长说成人话", () => {
    const M = 60000, D = 86400000;
    expect(fmt.span(20 * 1000)).toBe("不到 1 分钟");
    expect(fmt.span(5 * M)).toBe("5 分钟");
    expect(fmt.span(12 * D)).toBe("12 天");
    expect(fmt.span(365 * D)).toBe("1 年");
    expect(fmt.span(Math.round(2.7 * 365.25) * D)).toBe("2 年 8 个月");
  });
});

describe("fmt.progress", () => {
  it("等待进度落在 0–100", () => {
    expect(fmt.progress(0, 100, 50)).toBe(50);
    expect(fmt.progress(0, 100, -10)).toBe(0);
    expect(fmt.progress(0, 100, 999)).toBe(100);
    expect(fmt.progress(100, 100, 100)).toBe(100);
  });
});

describe("paletteOf（docs/02-design.md §9.6）", () => {
  it("同一个码永远是同一种颜色，色相在 0–359", () => {
    const a = paletteOf("GK25WIND");
    expect(paletteOf("GK25WIND")).toEqual(a);
    expect(a.hue).toBeGreaterThanOrEqual(0);
    expect(a.hue).toBeLessThan(360);
    expect(a.capLight).toBe(`oklch(0.84 0.14 ${a.hue})`);
  });
  it("没有码时用品牌色", () => {
    expect(paletteOf(null)).toEqual(BRAND_PALETTE);
    expect(BRAND_PALETTE.hue).toBe(68);
  });
});

describe("safeRedirect：只接受站内路径", () => {
  it("站内路径原样返回", () => {
    expect(safeRedirect("/me/favorites?x=1")).toBe("/me/favorites?x=1");
  });
  it("外站与协议相对地址回到兜底", () => {
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "", null]) {
      expect(safeRedirect(bad, "/")).toBe("/");
    }
  });
});

describe("addCalendarYears：开启时间上限按日历年算（与服务端同一算法）", () => {
  it("同月同日同一时刻", () => {
    const t = Date.UTC(2026, 10, 21, 8, 30);
    expect(new Date(addCalendarYears(t, 10)).toISOString()).toBe("2036-11-21T08:30:00.000Z");
  });
  it("2 月 29 日落到平年时取 2 月 28 日", () => {
    const t = Date.UTC(2028, 1, 29, 12);
    expect(new Date(addCalendarYears(t, 10)).toISOString()).toBe("2038-02-28T12:00:00.000Z");
  });
});
