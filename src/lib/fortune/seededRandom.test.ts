import { describe, expect, it } from "vitest";
import { mulberry32, hashStringToSeed } from "./seededRandom";

describe("seededRandom", () => {
  it("same seed yields same sequence", () => {
    const a = mulberry32(hashStringToSeed("abc"));
    const b = mulberry32(hashStringToSeed("abc"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
