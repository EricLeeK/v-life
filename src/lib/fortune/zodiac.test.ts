import { describe, expect, it } from "vitest";
import { zodiacFromBirthDate } from "./zodiac";

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
});
