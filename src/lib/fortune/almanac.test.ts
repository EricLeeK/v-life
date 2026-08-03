import { describe, expect, it } from "vitest";
import { Solar } from "lunar-javascript";
import { getAlmanacForDate } from "./almanac";
import { getLunarDayBundle } from "./lunarDay";

describe("getLunarDayBundle / getAlmanacForDate", () => {
  it("matches lunar-javascript yi/ji/chong for fixed dates", () => {
    for (const iso of ["2026-01-01", "2026-07-31", "2026-08-03"]) {
      const [y, m, d] = iso.split("-").map(Number);
      const lunar = Solar.fromYmd(y, m, d).getLunar();
      const bundle = getLunarDayBundle(iso);
      expect(bundle).not.toBeNull();
      expect(bundle!.dayPillar).toBe(lunar.getDayInGanZhi());
      expect(bundle!.yi).toEqual(lunar.getDayYi());
      expect(bundle!.ji).toEqual(lunar.getDayJi());
      expect(bundle!.clashZhi).toBe(lunar.getDayChong());
      expect(bundle!.chongsha).toBe(`冲${lunar.getDayChongShengXiao()}`);
      expect(bundle!.zhiXing).toBe(lunar.getZhiXing());

      const a = getAlmanacForDate(iso);
      expect(a.yi).toEqual(bundle!.yi);
      expect(a.ji).toEqual(bundle!.ji);
      expect(a.dayPillar).toBe(bundle!.dayPillar);
      expect(a.chongsha).toBe(bundle!.chongsha);
      expect(a.source).toContain("lunar-javascript");
    }
  });

  it("2026-01-01 is 乙亥 and 冲蛇", () => {
    const a = getAlmanacForDate("2026-01-01");
    expect(a.dayPillar).toBe("乙亥");
    expect(a.clashZhi).toBe("巳");
    expect(a.chongsha).toBe("冲蛇");
  });

  it("is stable for the same date", () => {
    expect(getAlmanacForDate("2026-07-31")).toEqual(getAlmanacForDate("2026-07-31"));
  });

  it("falls back safely for bad input", () => {
    const a = getAlmanacForDate("not-a-date");
    expect(a.yi.length).toBeGreaterThan(0);
  });
});
