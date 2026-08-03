import { describe, expect, it } from "vitest";
import { lunarLabelForDate } from "./lunarLabel";

describe("lunarLabelForDate", () => {
  it("2026-01-01 shows 十一月/冬 + 十三 + 乙亥", () => {
    const label = lunarLabelForDate("2026-01-01", "zh");
    expect(label).toContain("十三");
    expect(label).toContain("乙亥");
    expect(label).toMatch(/冬|十一/);
  });
});
