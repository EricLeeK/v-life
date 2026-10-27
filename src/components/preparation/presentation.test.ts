import { describe, expect, it } from "vitest";
import { examDateLabel, materialExcerpt } from "./presentation";

describe("备考列表展示", () => {
  it("缺失或异常考试日期不会让整个总览崩溃", () => {
    for (const value of [undefined, null, "", "2026-99-99", "invalid"]) {
      expect(examDateLabel(value)).toBe("日期待设置");
    }
    expect(examDateLabel("2027-03-13")).toBe("2027.03.13");
  });
  it("纯表格材料的摘要不显示 Markdown 语法残片", () => {
    const text = materialExcerpt("| 年份 | 收入 |\n| --- | ---: |\n| 2025 | 120 |");
    expect(text).toContain("2025");
    expect(text).not.toMatch(/\||---/);
  });
});
