import { describe, expect, it } from "vitest";
import { getMoonPhase } from "./moon";

describe("getMoonPhase", () => {
  it("returns named phase with elongation and illumination", () => {
    const m = getMoonPhase("2026-07-31");
    expect(m.phase).toBeTruthy();
    expect(m.blurbZh).toBeTruthy();
    expect(m.method).toBe("astronomy_engine_elongation");
    expect(m.elongationDeg).toBeGreaterThanOrEqual(0);
    expect(m.elongationDeg).toBeLessThan(360);
    expect(m.illumination).toBeGreaterThanOrEqual(0);
    expect(m.illumination).toBeLessThanOrEqual(1);
  });

  it("is stable for the same civil date", () => {
    expect(getMoonPhase("2026-01-01")).toEqual(getMoonPhase("2026-01-01"));
  });
});
