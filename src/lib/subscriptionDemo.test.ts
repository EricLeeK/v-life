import { describe, expect, it } from "vitest";
import { prepareDemoPayment } from "./subscriptionDemo";
import type { Subscription } from "./subscriptions";
const sub: Subscription = { id: "d211af6d-8800-4000-8000-000000000001", name: "Cloud", amount: 20, currency: "USD", url: null, management_url: null, category: "Cloud", plan: null, account: null, notes: null, billing_type: "fixed", billing_unit: "month", billing_interval: 1, auto_renew: true, status: "active", next_date: "2026-01-31", anchor_day: 31, reminder_days: 3 };
const input = { subscription_id: sub.id, due_date: "2026-01-31", paid_on: "2026-01-31", amount: 18, next_date: "2026-02-28", record_expense: true, exchange_rate: 7.2 };
describe("demo payment parity", () => {
  it("creates a linked historical expense without altering the contracted price", () => {
    const result = prepareDemoPayment(sub, [], input);
    expect(result.expense).toMatchObject({ amount: 18, amount_cny: 129.6, exchange_rate: 7.2, currency: "USD", category: "通讯/订阅" });
    expect(result.payment).toMatchObject({ period_date: "2026-01-31", next_date: "2026-02-28", finance_record_id: result.expense.id, record_expense: true, exchange_rate: 7.2 });
    expect(sub.amount).toBe(20);
  });
  it("returns identical retry and refuses conflicting payment for the same period", () => {
    const first = prepareDemoPayment(sub, [], input);
    expect(prepareDemoPayment({ ...sub, next_date: "2026-02-28" }, [first.payment], input)).toMatchObject({ duplicate: true, payment: first.payment });
    expect(() => prepareDemoPayment(sub, [first.payment], { ...input, amount: 19 })).toThrow();
  });
  it("refuses stale periods and missing FX before making records", () => {
    expect(() => prepareDemoPayment(sub, [], { ...input, due_date: "2026-01-01" })).toThrow();
    expect(() => prepareDemoPayment(sub, [], { ...input, exchange_rate: undefined })).toThrow();
  });
});
