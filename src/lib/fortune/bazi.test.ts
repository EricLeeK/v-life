import { describe, expect, it } from "vitest";
import { clashZhiFromDayZhi, dayPillarFromDate } from "./bazi";

describe("dayPillarFromDate", () => {
  it("1984-01-31 is 甲子 (verified anchor)", () => {
    expect(dayPillarFromDate("1984-01-31").label).toBe("甲子");
  });

  it("1984-02-02 is 丙寅 (not 甲子)", () => {
    expect(dayPillarFromDate("1984-02-02").label).toBe("丙寅");
  });

  it("2026-01-01 is 乙亥", () => {
    expect(dayPillarFromDate("2026-01-01").label).toBe("乙亥");
  });

  it("2019-01-27 is 甲子", () => {
    expect(dayPillarFromDate("2019-01-27").label).toBe("甲子");
  });

  it("clash of 亥 is 巳", () => {
    expect(clashZhiFromDayZhi("亥")).toBe("巳");
  });
});
