import { describe, expect, it } from "vitest";
import { almanacBalanceScore, dailyScores, shengxiaoRelationScore } from "./scores";
import { dayPillarFromDate } from "./bazi";
import { SHENGXIAO_ORDER } from "./shengxiao";

describe("dailyScores", () => {
  it("is stable for same inputs", () => {
    const a = dailyScores({ date: "2026-07-31", zodiac: "virgo", shengxiao: "tiger" });
    const b = dailyScores({ date: "2026-07-31", zodiac: "virgo", shengxiao: "tiger" });
    expect(a).toEqual(b);
    expect(a.overall).toBeGreaterThanOrEqual(1);
    expect(a.overall).toBeLessThanOrEqual(5);
  });

  it("varies across dates without profile (almanac-driven)", () => {
    const scores = ["2026-01-01", "2026-03-15", "2026-07-31", "2026-08-03", "2026-11-20"].map((date) =>
      dailyScores({ date }).overall,
    );
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it("shengxiao clash differs from harmony on the same day", () => {
    const date = "2026-01-01"; // 亥日 → day animal 猪; clash 蛇, harmony with 虎? 亥冲巳蛇; 六合 虎猪
    const pillar = dayPillarFromDate(date);
    expect(pillar.zhiZh).toBe("亥");
    const dayAnimal = SHENGXIAO_ORDER[["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"].indexOf(pillar.zhiZh)];
    expect(dayAnimal).toBe("pig");
    expect(shengxiaoRelationScore("snake", pillar.zhiZh)).toBe(-1);
    expect(shengxiaoRelationScore("tiger", pillar.zhiZh)).toBe(1);

    const clash = dailyScores({ date, shengxiao: "snake" });
    const harmony = dailyScores({ date, shengxiao: "tiger" });
    expect(harmony.overall).toBeGreaterThan(clash.overall);
  });

  it("zodiacFactor moves scores when provided", () => {
    const low = dailyScores({ date: "2026-08-03", zodiac: "aries", zodiacFactor: -1 });
    const high = dailyScores({ date: "2026-08-03", zodiac: "aries", zodiacFactor: 1 });
    expect(high.overall).toBeGreaterThanOrEqual(low.overall);
    expect(high.overall - low.overall).toBeGreaterThanOrEqual(1);
  });

  it("almanacBalanceScore is in [-1,1]", () => {
    const h = almanacBalanceScore("2026-08-03");
    expect(h).toBeGreaterThanOrEqual(-1);
    expect(h).toBeLessThanOrEqual(1);
  });
});
