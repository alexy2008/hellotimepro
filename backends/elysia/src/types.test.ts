import { describe, expect, test } from "bun:test";
import { dbTimestamp } from "./types";

describe("dbTimestamp", () => {
  test("matches seed format and lexical ordering", () => {
    const seed = "2026-07-13T01:00:00+00:00";
    const appLater = dbTimestamp(new Date("2026-07-13T23:00:00Z"));
    expect(appLater).toBe("2026-07-13T23:00:00+00:00");
    expect(seed < appLater).toBe(true);
  });

  test("trims trailing fractional zeros", () => {
    expect(dbTimestamp(new Date("2026-07-13T10:00:00.120Z"))).toBe(
      "2026-07-13T10:00:00.12+00:00",
    );
  });
});
