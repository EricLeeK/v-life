import { describe, expect, it } from "vitest";
import { shengxiaoFromBirthDate } from "./shengxiao";

describe("shengxiaoFromBirthDate (CNY boundary)", () => {
  it("day before 2024 CNY is rabbit", () => {
    expect(shengxiaoFromBirthDate("2024-02-09")).toBe("rabbit");
  });
  it("2024 CNY starts dragon", () => {
    expect(shengxiaoFromBirthDate("2024-02-10")).toBe("dragon");
  });
  it("2025 CNY starts snake", () => {
    expect(shengxiaoFromBirthDate("2025-01-28")).toBe("dragon");
    expect(shengxiaoFromBirthDate("2025-01-29")).toBe("snake");
  });
  it("2026 CNY starts horse", () => {
    expect(shengxiaoFromBirthDate("2026-02-16")).toBe("snake");
    expect(shengxiaoFromBirthDate("2026-02-17")).toBe("horse");
  });
  it("mid-year 1998 is tiger", () => {
    expect(shengxiaoFromBirthDate("1998-08-20")).toBe("tiger");
  });
});
