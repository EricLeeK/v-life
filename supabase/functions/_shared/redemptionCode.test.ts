import { describe, expect, it } from "vitest";
import {
  generateRedemptionCode,
  normalizeRedemptionCode,
  prefixOf,
  sha256Hex,
} from "./redemptionCode";

// Crockford-style alphabet without the easily-misread 0, 1, O, I.
const ALPHABET = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/;
const DISPLAY = /^VL[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){3}$/;

describe("generateRedemptionCode", () => {
  it("returns the VLXXXX-XXXX-XXXX-XXXX display format", () => {
    expect(generateRedemptionCode()).toMatch(DISPLAY);
  });

  it("never contains 0, 1, O or I", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRedemptionCode()).not.toMatch(/[01OI]/);
    }
  });

  it("produces unique codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRedemptionCode()));
    expect(codes.size).toBe(200);
  });
});

describe("normalizeRedemptionCode", () => {
  it("uppercases and strips dashes and spaces", () => {
    expect(normalizeRedemptionCode("vl3k9 m2xq-8b7t-c4we")).toBe("VL3K9M2XQ8B7TC4WE");
  });

  it("strips surrounding whitespace and any non-alphanumerics", () => {
    expect(normalizeRedemptionCode("  VL3K9-M2XQ_8B7T.C4WE!! ")).toBe("VL3K9M2XQ8B7TC4WE");
  });

  it("is idempotent on already-normalized codes", () => {
    expect(normalizeRedemptionCode("VL3K9M2XQ8B7TC4WE")).toBe("VL3K9M2XQ8B7TC4WE");
  });

  it("round-trips a generated display code to VL + 16 bare chars", () => {
    const bare = normalizeRedemptionCode(generateRedemptionCode());
    expect(bare).toMatch(/^VL[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/);
  });
});

describe("prefixOf", () => {
  it("returns the first 8 normalized chars for support lookups", () => {
    expect(prefixOf("vl3k9-m2xq-8b7t-c4we")).toBe("VL3K9M2X");
    expect(ALPHABET.test(prefixOf(generateRedemptionCode()))).toBe(true);
  });
});

describe("sha256Hex", () => {
  it("matches the standard SHA-256 test vector", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and differs across inputs", async () => {
    const a = await sha256Hex("VL3K9M2XQ8B7TC4WE");
    expect(await sha256Hex("vl3k9-m2xq-8b7t-c4we".replace(/[^A-Za-z0-9]/g, "").toUpperCase())).toBe(a);
    expect(await sha256Hex("different")).not.toBe(a);
  });
});
