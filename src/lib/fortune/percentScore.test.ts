import { describe, expect, it } from "vitest";
import { starsToDailyPercent } from "./percentScore";
import { weekdayIndex, weekdayLabel, lunarLabelForDate } from "./lunarLabel";

describe("starsToDailyPercent", () => {
  it("keeps band by stars but changes ones digit by seed", () => {
    const a = starsToDailyPercent(4, "2026-08-03|virgo|overall");
    const b = starsToDailyPercent(4, "2026-08-04|virgo|overall");
    expect(a).toBeGreaterThanOrEqual(40);
    expect(a).toBeLessThanOrEqual(99);
    expect(Math.floor(a / 10)).toBe(Math.floor(b / 10)); // same tens band for same stars
    expect(a).not.toBe(b); // ones (or full) differs by day
  });
});

describe("weekday", () => {
  it("2026-08-03 is Monday", () => {
    expect(weekdayIndex("2026-08-03")).toBe(1);
    expect(weekdayLabel("2026-08-03", "zh")).toBe("星期一");
  });

  it("label includes weekday", () => {
    expect(lunarLabelForDate("2026-08-03", "zh")).toContain("星期一");
  });
});
