import { describe, expect, it } from "vitest";
import {
  zodiacDetailsFromBirthDate,
  zodiacFromBirthDate,
  zodiacFromSunLongitude,
} from "./zodiac";

describe("zodiacFromBirthDate", () => {
  it("maps Aug 25 to virgo", () => {
    expect(zodiacFromBirthDate("1998-08-25")).toBe("virgo");
  });
  it("maps Dec 25 to capricorn", () => {
    expect(zodiacFromBirthDate("2000-12-25")).toBe("capricorn");
  });
  it("maps Aug 20 to leo", () => {
    expect(zodiacFromBirthDate("1998-08-20")).toBe("leo");
  });
  it("marks cusp on boundary day", () => {
    expect(zodiacDetailsFromBirthDate("1998-08-23").cuspSensitive).toBe(true);
    expect(zodiacDetailsFromBirthDate("1998-08-24").cuspSensitive).toBe(true);
  });
});

describe("zodiacFromSunLongitude", () => {
  it("returns ecliptic method and a sign", () => {
    const r = zodiacFromSunLongitude("1998-08-25", 12);
    expect(r.method).toBe("tropical_ecliptic_longitude");
    expect(r.sign).toBeTruthy();
    expect(r.sunLongitudeDeg).toBeGreaterThanOrEqual(0);
  });
});
