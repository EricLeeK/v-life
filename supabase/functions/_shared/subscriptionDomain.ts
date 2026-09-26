// Shared by the app and Agent endpoints so billing dates and totals stay consistent.
export type Currency = "CNY" | "USD" | "JPY";

export interface Subscription {
  id: string;
  user_id?: string;
  name: string;
  url: string | null;
  management_url: string | null;
  category: string;
  plan: string | null;
  account: string | null;
  notes: string | null;
  amount: number;
  currency: Currency;
  billing_type: "fixed" | "usage";
  billing_unit: "month" | "day";
  billing_interval: number;
  status: "active" | "trial" | "ended";
  auto_renew: boolean;
  next_date: string;
  anchor_day: number;
  reminder_days: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  period_date: string;
  paid_on: string;
  amount: number;
  currency: Currency;
  next_date: string;
  finance_record_id: string | null;
  record_expense: boolean;
  exchange_rate: number | null;
  created_at?: string;
}

export interface SubscriptionEvent {
  days: number;
  overdue: boolean;
  kind: "charge" | "expiry" | "trial";
  needsAttention: boolean;
}

export type CurrencyTotals = Partial<Record<Currency, number>>;

export interface SubscriptionSummary {
  monthly: CurrencyTotals;
  estimatedMonthly: CurrencyTotals;
  upcoming: CurrencyTotals;
  estimatedUpcoming: CurrencyTotals;
  dueSoon: number;
  needsAttention: number;
  activeCount: number;
}

const DAY_MS = 86_400_000;
const MEAN_MONTH_DAYS = 365.25 / 12;

export function localDate(): string {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

// Date-only arithmetic uses UTC to avoid local daylight-saving offsets.
function calendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid subscription date");
  }
  return date;
}

export function advanceSubscriptionDate(subscription: Subscription, pastDueDate = subscription.next_date): string {
  if (!Number.isInteger(subscription.billing_interval) || subscription.billing_interval < 1) {
    throw new Error("Billing interval must be a positive integer");
  }
  const date = calendarDate(pastDueDate);
  if (subscription.billing_unit === "day") {
    date.setUTCDate(date.getUTCDate() + subscription.billing_interval);
  } else {
    // Set the first day before changing months; retain the original anchor after February.
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + subscription.billing_interval);
    const monthEnd = new Date(date.getTime());
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(subscription.anchor_day, monthEnd.getUTCDate()));
  }
  return date.toISOString().slice(0, 10);
}

export function subscriptionState(subscription: Subscription, today: string): Subscription["status"] {
  if (subscription.status === "ended") return "ended";
  if (subscription.status === "trial") return "trial";
  if (!subscription.auto_renew && subscription.next_date < today) return "ended";
  return "active";
}

export function getSubscriptionEvent(subscription: Subscription, today: string): SubscriptionEvent | null {
  const state = subscriptionState(subscription, today);
  if (state === "ended") return null;
  const days = (calendarDate(subscription.next_date).getTime() - calendarDate(today).getTime()) / DAY_MS;
  return {
    days,
    overdue: days < 0,
    kind: state === "trial" ? "trial" : subscription.auto_renew ? "charge" : "expiry",
    needsAttention: subscription.reminder_days !== null && days <= subscription.reminder_days,
  };
}

function addAmount(totals: CurrencyTotals, currency: Currency, amount: number): void {
  totals[currency] = (totals[currency] ?? 0) + amount;
}

export function summarizeSubscriptions(items: readonly Subscription[], today: string): SubscriptionSummary {
  const summary: SubscriptionSummary = {
    monthly: {}, estimatedMonthly: {}, upcoming: {}, estimatedUpcoming: {},
    dueSoon: 0, needsAttention: 0, activeCount: 0,
  };
  const horizon = new Date(calendarDate(today).getTime() + 30 * DAY_MS).toISOString().slice(0, 10);

  for (const item of items) {
    const state = subscriptionState(item, today);
    const event = getSubscriptionEvent(item, today);
    if (state === "ended" || !event) continue;
    summary.activeCount += 1;
    if (event.days >= 0 && event.days <= 7) summary.dueSoon += 1;
    if (event.needsAttention) summary.needsAttention += 1;

    if (state === "active") {
      const amount = item.amount / item.billing_interval * (item.billing_unit === "day" ? MEAN_MONTH_DAYS : 1);
      addAmount(item.billing_type === "fixed" ? summary.monthly : summary.estimatedMonthly, item.currency, amount);
    }

    // Overdue records need confirmation; a forecast must never imply they were paid.
    if (!item.auto_renew || event.overdue) continue;
    const upcoming = item.billing_type === "fixed" ? summary.upcoming : summary.estimatedUpcoming;
    for (let date = item.next_date; date < horizon; date = advanceSubscriptionDate(item, date)) {
      addAmount(upcoming, item.currency, item.amount);
    }
  }
  return summary;
}

export function normalizeSubscriptionUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/\s|\\/.test(trimmed) || trimmed.startsWith("/") || (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed))) {
    throw new Error("Use a valid HTTP or HTTPS URL");
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Use a valid HTTP or HTTPS URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || !url.hostname.includes(".")) {
    throw new Error("Use a valid HTTP or HTTPS URL");
  }
  return url.href;
}

export function money(amount: number, currency: Currency, lang = "zh-CN"): string {
  return new Intl.NumberFormat(lang, { style: "currency", currency, currencyDisplay: "code" }).format(amount);
}
