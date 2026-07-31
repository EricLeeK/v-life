import { describe, expect, it } from "vitest";
import { shengxiaoFromBirthDate } from "./shengxiao";

describe("shengxiaoFromBirthDate", () => {
  it("1998 -> tiger", () => {
    expect(shengxiaoFromBirthDate("1998-08-20")).toBe("tiger");
  });
  it("1984 -> rat", () => {
    expect(shengxiaoFromBirthDate("1984-06-01")).toBe("rat");
  });
});
