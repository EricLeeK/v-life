import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errorMessage";

describe("getErrorMessage", () => {
  it("extracts useful Supabase error details from object errors", () => {
    expect(getErrorMessage({ message: "new row violates row-level security policy", code: "42501" }))
      .toBe("new row violates row-level security policy (42501)");
  });
});
