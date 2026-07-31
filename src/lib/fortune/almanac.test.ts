import { describe, expect, it } from "vitest";
import { getAlmanacForDate } from "./almanac";

describe("getAlmanacForDate", () => {
  it("returns yi/ji arrays and is stable", () => {
    const a = getAlmanacForDate("2026-07-31");
    const b = getAlmanacForDate("2026-07-31");
    expect(a.yi.length).toBeGreaterThan(0);
    expect(a.yi.length).toBeLessThanOrEqual(3);
    expect(a).toEqual(b);
  });
  it("falls back safely for any date", () => {
    const a = getAlmanacForDate("1900-01-01");
    expect(a.yi.length).toBeGreaterThan(0);
  });
});
