import { describe, expect, it } from "vitest";
import { castHexagram, kingWenFromYangFlags } from "./iching";

describe("King Wen lookup", () => {
  it("maps all-yin to 坤(2)", () => {
    expect(kingWenFromYangFlags([false, false, false, false, false, false])).toBe(2);
  });
  it("maps all-yang to 乾(1)", () => {
    expect(kingWenFromYangFlags([true, true, true, true, true, true])).toBe(1);
  });
  it("maps bottom-only yang to 复(24)", () => {
    expect(kingWenFromYangFlags([true, false, false, false, false, false])).toBe(24);
  });
});

describe("castHexagram", () => {
  it("is deterministic and in 1..64", () => {
    const a = castHexagram("s1");
    expect(a.lines).toHaveLength(6);
    expect(a).toEqual(castHexagram("s1"));
    expect(a.hexagramNumber).toBeGreaterThanOrEqual(1);
    expect(a.hexagramNumber).toBeLessThanOrEqual(64);
    expect(a.binaryBottomToTop).toHaveLength(6);
  });

  it("uses correct yin/yang for 6 and 9", () => {
    // Exhaust seeds until we observe both 6 and 9, or sample known coinLine via cast
    let saw6 = false;
    let saw9 = false;
    for (let i = 0; i < 200 && !(saw6 && saw9); i++) {
      const cast = castHexagram(`probe-${i}`);
      for (const line of cast.lines) {
        if (line.value === 6) {
          expect(line.yang).toBe(false);
          expect(line.changing).toBe(true);
          saw6 = true;
        }
        if (line.value === 9) {
          expect(line.yang).toBe(true);
          expect(line.changing).toBe(true);
          saw9 = true;
        }
      }
    }
    expect(saw6 && saw9).toBe(true);
  });
});
