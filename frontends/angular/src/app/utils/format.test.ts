import { describe, it, expect } from "vitest";
import { countdownTo, fmtNumber, isoToLocalInput, localInputToIso } from "./format";

describe("countdownTo", () => {
  it("正确分解秒数", () => {
    const now = new Date("2026-04-25T00:00:00Z").getTime();
    const target = new Date("2026-04-26T01:02:03Z").toISOString();
    const cd = countdownTo(target, now);
    expect(cd.expired).toBe(false);
    expect(cd.days).toBe(1);
    expect(cd.hours).toBe(1);
    expect(cd.minutes).toBe(2);
    expect(cd.seconds).toBe(3);
  });

  it("过去时刻返回 expired=true", () => {
    const now = Date.now();
    const past = new Date(now - 1000).toISOString();
    const cd = countdownTo(past, now);
    expect(cd.expired).toBe(true);
    expect(cd.totalSeconds).toBe(0);
  });
});

describe("fmtNumber", () => {
  it("千分位格式化", () => {
    expect(fmtNumber(1234567)).toMatch(/1[,，]234[,，]567/);
  });
});

describe("local <-> iso", () => {
  it("往返一致（截到分钟）", () => {
    const iso = "2026-06-30T12:34:00.000Z";
    const local = isoToLocalInput(iso);
    const back = localInputToIso(local);
    expect(back.slice(0, 16)).toBe(iso.slice(0, 16));
  });
});
