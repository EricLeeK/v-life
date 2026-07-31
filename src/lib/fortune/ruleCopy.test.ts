import { describe, expect, it } from "vitest";
import { buildDailyRuleCopy } from "./ruleCopy";

describe("buildDailyRuleCopy", () => {
  it("builds generic copy without profile", () => {
    const c = buildDailyRuleCopy({
      date: "2026-07-31",
      scores: { overall: 4, love: 3, career: 4, wealth: 3 },
      profile: null,
      lang: "zh",
    });
    expect(c.headline.length).toBeGreaterThan(0);
  });
});
