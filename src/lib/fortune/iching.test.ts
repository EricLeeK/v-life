import { describe, expect, it } from "vitest";
import { castHexagram } from "./iching";

describe("castHexagram", () => {
  it("returns hexagram with six lines from seed", () => {
    const a = castHexagram("s1");
    expect(a.lines).toHaveLength(6);
    expect(a).toEqual(castHexagram("s1"));
    expect(a.hexagramNumber).toBeGreaterThanOrEqual(1);
    expect(a.hexagramNumber).toBeLessThanOrEqual(64);
  });
});
