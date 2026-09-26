import { localDate, type Subscription, type SubscriptionPayment } from "./subscriptions";
import { normalizeSubscriptionPayment, type SubscriptionPaymentInput } from "../../supabase/functions/_shared/subscriptionOperations";

/** Prepare every write before changing demo state, matching the database transaction. */
export function prepareDemoPayment(sub: Subscription, payments: SubscriptionPayment[], raw: SubscriptionPaymentInput) {
  const input = normalizeSubscriptionPayment({ ...raw });
  if (sub.id !== input.subscription_id) throw new Error("未找到订阅");
  if (input.paid_on > localDate()) throw new Error("付款日期不能晚于今天");
  const previous = payments.find(p => p.subscription_id === sub.id && p.period_date === input.due_date);
  const rate = input.record_expense ? ((previous?.currency ?? sub.currency) === "CNY" ? 1 : input.exchange_rate) : null;
  if (input.record_expense && (!Number.isFinite(rate) || Number(rate) <= 0)) throw new Error("请填写有效的人民币汇率");
  if (previous) {
    if (previous.paid_on !== input.paid_on || previous.amount !== input.amount || previous.next_date !== input.next_date || previous.record_expense !== input.record_expense || previous.exchange_rate !== rate) throw new Error("本期已确认付款，提交内容与原记录不一致");
    return { payment: previous, expense: undefined, duplicate: true };
  }
  if (sub.status === "ended") throw new Error("请先恢复订阅，再确认付款");
  if (sub.next_date !== input.due_date) throw new Error("订阅日期已变化，请刷新后重试");
  const expense = input.record_expense ? {
    id: crypto.randomUUID(), name: `订阅 · ${sub.name}`, category: "通讯/订阅", date: input.paid_on,
    amount: input.amount, currency: sub.currency, amount_cny: Number((input.amount * Number(rate)).toFixed(2)), exchange_rate: Number(rate), notes: `订阅账期 ${input.due_date}`,
  } : undefined;
  const payment: SubscriptionPayment = {
    id: crypto.randomUUID(), subscription_id: sub.id, period_date: input.due_date, paid_on: input.paid_on,
    amount: input.amount, currency: sub.currency, next_date: input.next_date, finance_record_id: expense?.id ?? null,
    record_expense: input.record_expense, exchange_rate: rate ?? null, created_at: new Date().toISOString(),
  };
  return { payment, expense, duplicate: false };
}
