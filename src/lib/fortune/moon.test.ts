import { describe, expect, it } from "vitest";
import { getMoonPhase } from "./moon";

describe("getMoonPhase", () => {
  it("returns a named phase", () => {
    const m = getMoonPhase("2026-07-31");
    expect(m.phase).toBeTruthy();
    expect(m.blurbZh).toBeTruthy();
  });
});
