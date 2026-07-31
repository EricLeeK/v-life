import { describe, expect, it } from "vitest";
import { drawLot } from "./lot";

describe("drawLot", () => {
  it("reproduces from seed", () => {
    expect(drawLot("s1")).toEqual(drawLot("s1"));
    expect(["上上", "上吉", "中吉", "中平", "下下"]).toContain(drawLot("s1").rankZh);
  });
});
