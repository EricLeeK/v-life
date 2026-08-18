import { describe, expect, it } from "vitest";
import { pickSettingsRow } from "@/lib/pickSettingsRow";

describe("pickSettingsRow", () => {
  it("returns null for an empty list", () => {
    expect(pickSettingsRow([])).toBeNull();
  });

  it("prefers a row with nickname and fortune profile over a newer empty row", () => {
    const empty = {
      id: "empty",
      display_name: null,
      fortune_profile: null,
      updated_at: "2026-08-11T13:49:56.275879+00",
    };
    const complete = {
      id: "complete",
      display_name: "Super TT",
      fortune_profile: { birth_date: "1990-01-01" },
      updated_at: "2026-08-10T07:04:59.031713+00",
    };
    expect(pickSettingsRow([empty, complete])?.id).toBe("complete");
  });

  it("when completeness is equal, prefers the most recently updated row", () => {
    const older = {
      id: "older",
      display_name: "A",
      fortune_profile: { birth_date: "1990-01-01" },
      updated_at: "2026-05-10T05:52:59.597366+00",
    };
    const newer = {
      id: "newer",
      display_name: "A",
      fortune_profile: { birth_date: "1990-01-01" },
      updated_at: "2026-08-13T06:43:55.024648+00",
    };
    expect(pickSettingsRow([older, newer])?.id).toBe("newer");
  });
});
