import { describe, expect, it } from "vitest";
import { dayPillarFromDate } from "./bazi";

describe("dayPillarFromDate", () => {
  it("returns gan-zhi pair", () => {
    const p = dayPillarFromDate("1998-08-20", 9);
    expect(p.ganZh).toBeTruthy();
    expect(p.zhiZh).toBeTruthy();
    expect(p.wuxing).toHaveLength(5);
  });
  it("1984-02-02 is 甲子", () => {
    const p = dayPillarFromDate("1984-02-02");
    expect(p.label).toBe("甲子");
  });
});
