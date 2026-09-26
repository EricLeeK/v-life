import { afterEach, describe, expect, it, vi } from "vitest";
import * as subscriptions from "./subscriptions";
import type { Subscription } from "./subscriptions";

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: "subscription-1",
  name: "Cloud storage",
  url: null,
  management_url: null,
  category: "工具",
  plan: null,
  account: null,
  notes: null,
  amount: 30,
  currency: "CNY",
  billing_type: "fixed",
  billing_unit: "month",
  billing_interval: 1,
  status: "active",
  auto_renew: true,
  next_date: "2026-01-31",
  anchor_day: 31,
  reminder_days: 3,
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("localDate", () => {
  it("uses the local calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 5));
    expect(subscriptions.localDate()).toBe("2026-01-01");
  });
});

describe("advanceSubscriptionDate", () => {
  it("restores the original billing day after a short month", () => {
    const item = sub();
    expect(subscriptions.advanceSubscriptionDate(item)).toBe("2026-02-28");
    expect(subscriptions.advanceSubscriptionDate(item, "2026-02-28")).toBe("2026-03-31");
  });

  it("retains a leap-day anchor through yearly renewals", () => {
    const item = sub({ next_date: "2024-02-29", anchor_day: 29, billing_interval: 12 });
    expect(subscriptions.advanceSubscriptionDate(item)).toBe("2025-02-28");
    expect(subscriptions.advanceSubscriptionDate(item, "2027-02-28")).toBe("2028-02-29");
  });

  it("advances custom month intervals across years", () => {
    expect(subscriptions.advanceSubscriptionDate(sub({ next_date: "2026-11-30", anchor_day: 31, billing_interval: 3 })))
      .toBe("2027-02-28");
  });

  it("advances day intervals across leap days without changing the anchor", () => {
    expect(subscriptions.advanceSubscriptionDate(sub({ next_date: "2024-02-27", billing_unit: "day", billing_interval: 3 })))
      .toBe("2024-03-01");
  });

  it("rejects a non-advancing billing interval", () => {
    expect(() => subscriptions.advanceSubscriptionDate(sub({ billing_interval: 0 }))).toThrow();
  });
});

describe("subscriptionState", () => {
  it("ends a manual plan only after its expiry date", () => {
    const item = sub({ auto_renew: false });
    expect(subscriptions.subscriptionState(item, "2026-01-31")).toBe("active");
    expect(subscriptions.subscriptionState(item, "2026-02-01")).toBe("ended");
  });

  it("keeps overdue auto-renewals pending confirmation", () => {
    expect(subscriptions.subscriptionState(sub(), "2026-02-01")).toBe("active");
  });

  it("keeps expired trials pending conversion or cancellation", () => {
    expect(subscriptions.subscriptionState(sub({ status: "trial", auto_renew: false }), "2026-02-01")).toBe("trial");
  });

  it("preserves an explicit ended state", () => {
    expect(subscriptions.subscriptionState(sub({ status: "ended" }), "2026-01-01")).toBe("ended");
  });
});

describe("getSubscriptionEvent", () => {
  it("distinguishes automatic charges, manual expiry and trial expiry", () => {
    expect(subscriptions.getSubscriptionEvent(sub(), "2026-01-29"))
      .toEqual({ days: 2, overdue: false, kind: "charge", needsAttention: true });
    expect(subscriptions.getSubscriptionEvent(sub({ auto_renew: false }), "2026-01-29"))
      .toEqual({ days: 2, overdue: false, kind: "expiry", needsAttention: true });
    expect(subscriptions.getSubscriptionEvent(sub({ status: "trial" }), "2026-02-01"))
      .toEqual({ days: -1, overdue: true, kind: "trial", needsAttention: true });
  });

  it("honors the configured reminder horizon", () => {
    expect(subscriptions.getSubscriptionEvent(sub({ reminder_days: 7 }), "2026-01-24")?.needsAttention).toBe(true);
    expect(subscriptions.getSubscriptionEvent(sub({ reminder_days: 3 }), "2026-01-24")?.needsAttention).toBe(false);
    expect(subscriptions.getSubscriptionEvent(sub({ reminder_days: 0 }), "2026-01-31")?.needsAttention).toBe(true);
  });

  it("keeps disabled reminders quiet even when overdue", () => {
    expect(subscriptions.getSubscriptionEvent(sub({ reminder_days: null }), "2026-02-01"))
      .toEqual({ days: -1, overdue: true, kind: "charge", needsAttention: false });
  });

  it("does not create an event for ended subscriptions", () => {
    expect(subscriptions.getSubscriptionEvent(sub({ status: "ended" }), "2026-01-01")).toBeNull();
    expect(subscriptions.getSubscriptionEvent(sub({ auto_renew: false }), "2026-02-01")).toBeNull();
  });
});

describe("summarizeSubscriptions", () => {
  it("keeps currencies and usage estimates separate while normalizing month intervals", () => {
    const result = subscriptions.summarizeSubscriptions([
      sub({ amount: 30 }),
      sub({ currency: "USD", amount: 120, billing_interval: 12 }),
      sub({ currency: "JPY", amount: 900, billing_interval: 3 }),
      sub({ billing_type: "usage", amount: 8 }),
    ], "2026-01-01");
    expect(result.monthly).toEqual({ CNY: 30, USD: 10, JPY: 300 });
    expect(result.estimatedMonthly).toEqual({ CNY: 8 });
  });

  it("normalizes day intervals using the mean calendar month", () => {
    const result = subscriptions.summarizeSubscriptions([sub({ amount: 7, billing_unit: "day", billing_interval: 7 })], "2026-01-01");
    expect(result.monthly.CNY).toBeCloseTo(365.25 / 12);
  });

  it("counts every charge within thirty days and excludes the upper boundary", () => {
    const result = subscriptions.summarizeSubscriptions([
      sub({ amount: 5, next_date: "2026-01-01", billing_unit: "day", billing_interval: 7 }),
      sub({ amount: 100, next_date: "2026-01-31" }),
    ], "2026-01-01");
    expect(result.upcoming).toEqual({ CNY: 25 });
  });

  it("projects month-end cycles within the same thirty-day window", () => {
    const result = subscriptions.summarizeSubscriptions([sub()], "2026-01-31");
    expect(result.upcoming).toEqual({ CNY: 60 });
  });

  it("separates usage estimates from expected fixed charges", () => {
    const result = subscriptions.summarizeSubscriptions([
      sub({ amount: 20, next_date: "2026-01-05" }),
      sub({ amount: 9, next_date: "2026-01-05", billing_type: "usage", currency: "USD" }),
    ], "2026-01-01");
    expect(result.upcoming).toEqual({ CNY: 20 });
    expect(result.estimatedUpcoming).toEqual({ USD: 9 });
  });

  it("excludes trials from paid monthly cost but projects their automatic conversion", () => {
    const result = subscriptions.summarizeSubscriptions([
      sub({ status: "trial", next_date: "2026-01-05" }),
      sub({ status: "trial", auto_renew: false, next_date: "2026-01-05", amount: 100 }),
    ], "2026-01-01");
    expect(result.monthly).toEqual({});
    expect(result.upcoming).toEqual({ CNY: 30 });
    expect(result.activeCount).toBe(2);
  });

  it("does not project a payment for manual expiry", () => {
    const result = subscriptions.summarizeSubscriptions([sub({ auto_renew: false, next_date: "2026-01-05" })], "2026-01-01");
    expect(result.monthly).toEqual({ CNY: 30 });
    expect(result.upcoming).toEqual({});
  });

  it("leaves overdue charges pending instead of silently advancing them", () => {
    const item = sub({ next_date: "2025-12-31" });
    const result = subscriptions.summarizeSubscriptions([item], "2026-01-01");
    expect(result.upcoming).toEqual({});
    expect(result.needsAttention).toBe(1);
    expect(result.dueSoon).toBe(0);
    expect(item.next_date).toBe("2025-12-31");
  });

  it("counts the next seven days independently of custom or disabled reminders", () => {
    const result = subscriptions.summarizeSubscriptions([
      sub({ next_date: "2026-01-08", reminder_days: null }),
      sub({ next_date: "2026-01-08", reminder_days: 0 }),
      sub({ next_date: "2026-01-11", reminder_days: 14 }),
    ], "2026-01-01");
    expect(result.dueSoon).toBe(2);
    expect(result.needsAttention).toBe(1);
  });

  it("excludes explicit and expired manual subscriptions from all aggregates", () => {
    expect(subscriptions.summarizeSubscriptions([
      sub({ status: "ended" }),
      sub({ auto_renew: false, next_date: "2025-12-31" }),
    ], "2026-01-01")).toEqual({
      monthly: {}, estimatedMonthly: {}, upcoming: {}, estimatedUpcoming: {},
      dueSoon: 0, needsAttention: 0, activeCount: 0,
    });
  });
});

describe("normalizeSubscriptionUrl", () => {
  it("turns bare domains into secure links and preserves explicit HTTP URLs", () => {
    expect(subscriptions.normalizeSubscriptionUrl("  example.com/account?a=1  ")).toBe("https://example.com/account?a=1");
    expect(subscriptions.normalizeSubscriptionUrl("http://example.com/account")).toBe("http://example.com/account");
  });

  it("returns null for an empty optional link", () => {
    expect(subscriptions.normalizeSubscriptionUrl("  ")).toBeNull();
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://example.com", "https://", "not a domain", "/settings", "mailto:user@example.com"])("rejects unsafe or malformed input: %s", (value) => {
    expect(() => subscriptions.normalizeSubscriptionUrl(value)).toThrow();
  });
});

describe("money", () => {
  it("makes yuan and yen unambiguous with currency codes", () => {
    expect(subscriptions.money(1234.5, "CNY", "en")).toMatch(/CNY\s*1,234\.50/);
    expect(subscriptions.money(1234, "JPY", "en")).toMatch(/JPY\s*1,234/);
    expect(subscriptions.money(12, "USD", "zh")).toMatch(/USD\s*12\.00/);
  });
});
