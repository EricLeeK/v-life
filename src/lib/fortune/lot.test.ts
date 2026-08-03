import { describe, expect, it } from "vitest";
import { drawLot, LOT_POOL_SIZE } from "./lot";

describe("drawLot", () => {
  it("has 100 product lots", () => {
    expect(LOT_POOL_SIZE).toBe(100);
  });

  it("reproduces from seed and stays soft-ranked", () => {
    expect(drawLot("s1")).toEqual(drawLot("s1"));
    expect(["上上", "上吉", "中吉", "中平", "下平"]).toContain(drawLot("s1").rankZh);
    expect(drawLot("s1").traditionalSystemClaim).toBe(false);
  });
});
