import { describe, expect, it } from "vitest";
import { dailyScores } from "./scores";

describe("dailyScores", () => {
  it("is stable for same inputs", () => {
    const a = dailyScores({ date: "2026-07-31", zodiac: "virgo", shengxiao: "tiger" });
    const b = dailyScores({ date: "2026-07-31", zodiac: "virgo", shengxiao: "tiger" });
    expect(a).toEqual(b);
    expect(a.overall).toBeGreaterThanOrEqual(1);
    expect(a.overall).toBeLessThanOrEqual(5);
  });
});
