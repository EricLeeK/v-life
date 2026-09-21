import { describe, expect, it } from "vitest";
import { convertExpense } from "./financeConversion";

describe("convertExpense", () => {
  const historic = { amount: 1000, currency: "JPY", amount_cny: 50, exchange_rate: 0.05 };

  it("keeps the stored amount and rate when only metadata is edited", () => {
    expect(convertExpense(1000, "JPY", 0.06, historic)).toEqual({ rate: 0.05, amountCny: 50 });
  });

  it("uses the stored rate when the historical amount changes", () => {
    expect(convertExpense(2000, "JPY", 0.06, historic)).toEqual({ rate: 0.05, amountCny: 100 });
  });

  it("uses the current rate for a new expense", () => {
    expect(convertExpense(1000, "JPY", 0.06)).toEqual({ rate: 0.06, amountCny: 60 });
  });
});
