import { useRef, useState, type ReactNode, type FormEvent } from "react";
import { Plus, ExternalLink, Edit2, Trash2, ReceiptText, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/contexts/LanguageContext";
import { useLocalDate } from "@/hooks/useLocalDate";
import { useSubscriptions, useSubscriptionPayments, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import { advanceSubscriptionDate, getSubscriptionEvent, money, subscriptionState, summarizeSubscriptions, type Subscription } from "@/lib/subscriptions";
import { normalizeSubscription } from "../../../supabase/functions/_shared/subscriptionOperations";
import { getErrorMessage } from "@/lib/errorMessage";
import { subscriptionLoadErrorMessage } from "@/lib/subscriptionQuery";

const selectClass = "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
function cycle(item: Subscription, zh: boolean) {
  if (item.billing_unit === "month" && item.billing_interval === 12) return zh ? "年" : "year";
  if (item.billing_unit === "month" && item.billing_interval === 3) return zh ? "季" : "quarter";
  return `${item.billing_interval === 1 ? "" : item.billing_interval}${item.billing_unit === "month" ? (zh ? "月" : " month(s)") : (zh ? "天" : " day(s)")}`.trim();
}
function siteLabel(url: string) { try { return new URL(url).hostname; } catch { return url; } }
const newForm = (today: string) => ({ name: "", url: "", management_url: "", category: "", plan: "", account: "", notes: "", amount: "", currency: "CNY", billing_type: "fixed", period: "month", billing_unit: "month", billing_interval: "1", status: "active", auto_renew: true, next_date: today, anchor_day: String(Number(today.slice(-2))), reminder_days: "3" });
type FormState = ReturnType<typeof newForm>;

export function SubscriptionPanel() {
  const { t, lang } = useLang();
  const today = useLocalDate();
  const query = useSubscriptions();
  const items = query.data ?? [];
  const { save, remove, confirmPayment } = useSubscriptionMutations();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ongoing");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<Subscription | "new" | null>(null);
  const [form, setForm] = useState<FormState>(() => newForm(today));
  const [paying, setPaying] = useState<Subscription | null>(null);
  const [payment, setPayment] = useState({ amount: "", paid_on: today, next_date: "", record_expense: false, exchange_rate: "" });
  const [details, setDetails] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const history = useSubscriptionPayments(details?.id);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const summary = summarizeSubscriptions(items, today);
  const categories = [...new Set(items.map(item => item.category))].sort();
  const visible = items.filter(item => {
    const state = subscriptionState(item, today);
    const matchesState = filter === "all" || (filter === "ongoing" ? state !== "ended" : filter === "attention" ? getSubscriptionEvent(item, today)?.needsAttention : filter === state);
    return matchesState && (category === "all" || item.category === category) && [item.name, item.url, item.management_url, item.account, item.plan].join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase());
  }).sort((a, b) => a.next_date.localeCompare(b.next_date) || a.name.localeCompare(b.name));
  const set = (key: keyof FormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const openEditor = (item?: Subscription) => {
    setError("");
    setForm(item ? { ...newForm(today), ...item, amount: String(item.amount), billing_interval: String(item.billing_interval), anchor_day: String(item.anchor_day), reminder_days: item.reminder_days === null ? "off" : String(item.reminder_days), url: item.url ?? "", management_url: item.management_url ?? "", plan: item.plan ?? "", account: item.account ?? "", notes: item.notes ?? "", period: item.billing_unit === "month" && [1, 3, 12].includes(item.billing_interval) ? ({ 1: "month", 3: "quarter", 12: "year" }[item.billing_interval]!) : "custom" } : newForm(today));
    setEditor(item ?? "new");
  };
  const run = async (action: () => Promise<unknown>, done: () => void) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); done(); } catch (e) { setError(getErrorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  const saveForm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { period } = form;
      const raw = Object.fromEntries(Object.keys(newForm(today)).filter(key => key !== "period").map(key => [key, form[key as keyof FormState]]));
      const payload = normalizeSubscription({ ...raw, amount: Number(form.amount), billing_unit: period === "custom" ? form.billing_unit : "month", billing_interval: period === "custom" ? Number(form.billing_interval) : { month: 1, quarter: 3, year: 12 }[period], anchor_day: Number(form.anchor_day), reminder_days: form.reminder_days === "off" ? null : Number(form.reminder_days), category: form.category.trim() || "其他" });
      return save.mutateAsync({ ...payload, ...(editor && editor !== "new" ? { id: editor.id, expected_updated_at: editor.updated_at } : {}) });
    }, () => setEditor(null));
  };
  const openPayment = (item: Subscription) => {
    setError("");
    setPayment({ amount: String(item.amount), paid_on: today, next_date: advanceSubscriptionDate(item), record_expense: false, exchange_rate: "" });
    setPaying(item);
  };
  const amounts = (values: Partial<Record<"CNY" | "USD" | "JPY", number>>) => {
    const entries = Object.entries(values);
    return entries.length ? entries.map(([currency, value]) => <span key={currency} className="block font-mono-data tabular-nums">{money(value, currency as Subscription["currency"], lang)}</span>) : <span>—</span>;
  };
  const modalError = error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;
  const safeLink = (url: string | null) => url && /^https?:\/\//i.test(url) ? url : undefined;

  if (query.isLoading) return <p role="status" className="py-12 text-center text-muted-foreground">{t("正在加载订阅…", "Loading subscriptions…")}</p>;
  if (query.error) return <div role="alert" className="space-y-3 py-8"><p>{t("加载订阅失败", "Could not load subscriptions")}</p><p className="text-sm text-muted-foreground">{subscriptionLoadErrorMessage(query.error, lang)}</p><Button variant="outline" onClick={() => query.refetch()}>{t("重试", "Retry")}</Button></div>;

  return <section aria-label={t("订阅服务", "Subscriptions")} className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">{t("每一笔订阅，心中有数", "Keep track of every subscription")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("服务、价格与续费日期，都在这里。", "Your services, prices and renewal dates in one place.")}</p></div>
      <Button className="min-h-11" onClick={() => openEditor()}><Plus className="mr-1.5 h-4 w-4" />{t("添加订阅", "Add subscription")}</Button>
    </div>
    <div className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-3">
      <div><p className="text-sm text-muted-foreground">{t("月均固定成本", "Monthly fixed cost")}</p><div className="mt-2 text-xl font-semibold">{amounts(summary.monthly)}</div>{Object.keys(summary.estimatedMonthly).length > 0 && <div className="mt-2 text-xs text-muted-foreground">{t("另有按量估算 / 月", "Plus usage estimate / month")}{amounts(summary.estimatedMonthly)}</div>}</div>
      <div><p className="text-sm text-muted-foreground">{t("未来 30 天预计扣款", "Expected charges · next 30 days")}</p><div className="mt-2 text-xl font-semibold">{amounts(summary.upcoming)}</div>{Object.keys(summary.estimatedUpcoming).length > 0 && <div className="mt-2 text-xs text-muted-foreground">{t("另有按量估算", "Plus estimated usage")}{amounts(summary.estimatedUpcoming)}</div>}</div>
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 sm:col-span-1 sm:block"><p className="text-sm text-muted-foreground">{t("7 天内到期 / 扣款", "Due within 7 days")}</p><p className="mt-2 text-xl font-semibold font-mono-data">{summary.dueSoon}<span className="ml-1 text-sm font-normal">{t("项", "items")}</span></p><p className="mt-2 text-xs text-muted-foreground">{summary.activeCount} {t("项在用，含试用", "ongoing, including trials")}</p></div>
    </div>
    <p className="text-xs text-muted-foreground">{t("月均按周期折算，按天订阅按年均折算；试用不计入月均。预计扣款仅包含自动续费，待确认的历史扣款另行处理。", "Monthly costs normalize billing cycles (day plans use the annual average) and exclude trials. Forecasts include auto-renewals only; overdue charges need confirmation.")}</p>
    {summary.needsAttention > 0 && <button onClick={() => setFilter("attention")} className="flex min-h-11 w-full items-center gap-2 rounded-md bg-cat-orange-bg p-3 text-left text-sm text-cat-orange"><Bell className="h-4 w-4 shrink-0" />{t(`${summary.needsAttention} 项订阅需要留意，点击查看`, `${summary.needsAttention} subscriptions need attention — view`)}</button>}
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-0 flex-1 basis-48"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label={t("搜索订阅", "Search subscriptions")} placeholder={t("搜索名称、网址、账号", "Search name, URL or account")} value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-9 text-base sm:text-sm" /></div>
      <select aria-label={t("订阅状态", "Subscription status")} value={filter} onChange={e => setFilter(e.target.value)} className={`${selectClass} basis-[calc(50%-0.25rem)] flex-1 sm:basis-auto sm:w-auto sm:flex-none max-w-full`}>
        <option value="ongoing">{t("在用与试用", "Active & trials")}</option><option value="attention">{t("需要留意", "Needs attention")}</option><option value="active">{t("使用中", "Active")}</option><option value="trial">{t("试用中", "Trial")}</option><option value="ended">{t("已结束", "Ended")}</option><option value="all">{t("全部状态", "All statuses")}</option>
      </select>
      <select aria-label={t("筛选分类", "Filter category")} value={category} onChange={e => setCategory(e.target.value)} className={`${selectClass} basis-[calc(50%-0.25rem)] flex-1 sm:basis-auto sm:w-auto sm:flex-none max-w-full`}><option value="all">{t("全部分类", "All categories")}</option>{categories.map(value => <option key={value}>{value}</option>)}</select>
    </div>
    {visible.length === 0 ? <div className="py-12 text-center"><ReceiptText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p>{items.length === 0 ? t("从第一项订阅开始", "Start with your first subscription") : t("没有符合条件的订阅", "No matching subscriptions")}</p><p className="mt-2 text-sm text-muted-foreground">{items.length === 0 ? t("记录一个常用服务，记住它的价格与续费日。", "Add a service to track its cost and renewal.") : t("试试其他关键词或筛选条件。", "Try another search or filter.")}</p></div> : <ul className="divide-y divide-border border-y border-border">
      {visible.map(item => {
        const state = subscriptionState(item, today), event = getSubscriptionEvent(item, today);
        const stateLabel = state === "ended" ? t("已结束", "Ended") : state === "trial" ? t("试用中", "Trial") : t("使用中", "Active");
        const dateLabel = item.status === "trial" ? t("试用结束", "Trial ends") : item.auto_renew ? t("预计扣款", "Expected charge") : t("服务到期", "Expires");
        return <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-4 md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_minmax(9rem,0.55fr)]">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><button onClick={() => { setDetails(item); setError(""); }} className="min-h-11 break-all text-left font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.name}</button><Badge variant="secondary">{item.category}</Badge></div><p className="break-all text-sm text-muted-foreground">{[item.plan, item.account, item.url ? siteLabel(item.url) : null].filter(Boolean).join(" · ") || t("尚未填写网址", "No website added")}</p><div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">{safeLink(item.url) && <a href={item.url!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">{t("打开网站", "Open website")}<ExternalLink className="h-3 w-3" /></a>}{safeLink(item.management_url) && <a href={item.management_url!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-muted-foreground underline underline-offset-4">{t("管理订阅", "Manage subscription")}<ExternalLink className="h-3 w-3" /></a>}</div></div>
          <div className="self-center"><p className="font-mono-data text-base font-semibold tabular-nums">{money(item.amount, item.currency, lang)}<span className="text-sm font-normal text-muted-foreground"> / {cycle(item, lang === "zh")}</span></p><p className="mt-1 text-xs text-muted-foreground">{state === "trial" ? t("试用后的价格", "Price after trial") : item.billing_type === "usage" ? t("按量计费 · 估算", "Usage-based · estimate") : t("固定费用", "Fixed price")}</p></div>
          <div className="col-span-2 self-center md:col-span-1"><p className={`text-sm ${event?.needsAttention ? "text-cat-orange font-medium" : "text-foreground"}`}>{item.next_date} · {event?.overdue ? t("待确认", "Needs confirmation") : dateLabel}</p><p className="mt-1 text-xs text-muted-foreground">{stateLabel} · {item.auto_renew ? t("自动续费", "Auto-renews") : t("手动续费", "Manual renewal")}</p><div className="mt-2 flex flex-wrap gap-1">{item.status !== "ended" && <Button variant="outline" size="sm" className="min-h-11" aria-label={`${t("确认付款", "Confirm payment")} ${item.name}`} onClick={() => openPayment(item)}>{t("确认付款", "Confirm payment")}</Button>}<Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`${t("编辑", "Edit")} ${item.name}`} onClick={() => openEditor(item)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label={`${t("删除", "Delete")} ${item.name}`} onClick={() => { setDeleting(item); setError(""); }}><Trash2 className="h-4 w-4" /></Button></div></div>
        </li>;
      })}
    </ul>}
    <Dialog open={editor !== null} onOpenChange={open => { if (!open && !busy) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editor === "new" ? t("添加订阅", "Add subscription") : t("编辑订阅", "Edit subscription")}</DialogTitle><DialogDescription>{t("记录实际订购的价格，日期用于续费与到期提醒。", "Record your actual plan price and next renewal or expiry date.")}</DialogDescription></DialogHeader>
      <form onSubmit={saveForm}><fieldset disabled={busy} className="space-y-4">
        <Field id="sub-name" label={t("服务名称 *", "Service name *")}><Input id="sub-name" required maxLength={200} value={form.name} onChange={e => set("name", e.target.value)} className="text-base sm:text-sm" autoFocus /></Field>
        <Field id="sub-url" label={t("服务网址", "Website URL")}><Input id="sub-url" placeholder="https://example.com" value={form.url} onChange={e => set("url", e.target.value)} className="text-base sm:text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field id="sub-amount" label={t("价格 *", "Price *")}><Input id="sub-amount" type="number" required min="0" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} className="text-base sm:text-sm" /></Field><Field id="sub-currency" label={t("币种", "Currency")}><select id="sub-currency" className={selectClass} value={form.currency} onChange={e => set("currency", e.target.value)}>{["CNY", "USD", "JPY"].map(v => <option key={v}>{v}</option>)}</select></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field id="sub-type" label={t("计费方式", "Pricing")}><select id="sub-type" className={selectClass} value={form.billing_type} onChange={e => set("billing_type", e.target.value)}><option value="fixed">{t("固定费用", "Fixed")}</option><option value="usage">{t("按量估算", "Usage estimate")}</option></select></Field><Field id="sub-period" label={t("付费周期", "Billing cycle")}><select id="sub-period" className={selectClass} value={form.period} onChange={e => set("period", e.target.value)}><option value="month">{t("月付", "Monthly")}</option><option value="quarter">{t("季付", "Quarterly")}</option><option value="year">{t("年付", "Yearly")}</option><option value="custom">{t("自定义", "Custom")}</option></select></Field></div>
        {form.period === "custom" && <div className="grid grid-cols-2 gap-3"><Field id="sub-interval" label={t("每隔", "Every")}><Input className="text-base sm:text-sm" id="sub-interval" type="number" required min="1" max={form.billing_unit === "month" ? 120 : 3660} step="1" value={form.billing_interval} onChange={e => set("billing_interval", e.target.value)} /></Field><Field id="sub-unit" label={t("周期单位", "Cycle unit")}><select id="sub-unit" className={selectClass} value={form.billing_unit} onChange={e => set("billing_unit", e.target.value)}><option value="month">{t("个月", "months")}</option><option value="day">{t("天", "days")}</option></select></Field></div>}
        <Field id="sub-date" label={t("下次扣款／到期日 *", "Next charge / expiry date *")}><Input id="sub-date" required type="date" value={form.next_date} onChange={e => setForm(prev => ({ ...prev, next_date: e.target.value, anchor_day: String(Number(e.target.value.slice(-2))) }))} className="text-base sm:text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field id="sub-state" label={t("状态", "Status")}><select id="sub-state" className={selectClass} value={form.status} onChange={e => set("status", e.target.value)}><option value="active">{t("使用中", "Active")}</option><option value="trial">{t("试用中", "Trial")}</option><option value="ended">{t("已结束", "Ended")}</option></select></Field><Field id="sub-reminder" label={t("提醒时间", "Reminder")}><select id="sub-reminder" className={selectClass} value={form.reminder_days} onChange={e => set("reminder_days", e.target.value)}><option value="off">{t("关闭", "Off")}</option><option value="0">{t("当天", "On the day")}</option><option value="3">{t("提前 3 天", "3 days before")}</option><option value="7">{t("提前 7 天", "7 days before")}</option>{!["off", "0", "3", "7"].includes(form.reminder_days) && <option value={form.reminder_days}>{form.reminder_days} {t("天前", "days before")}</option>}</select></Field></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_renew} onChange={e => set("auto_renew", e.target.checked)} className="h-4 w-4 accent-primary" />{t("自动续费", "Auto-renewal")}</label>
        <p className="text-xs text-muted-foreground">{t("这里只记录续费状态；取消扣费请前往服务商。提醒显示在本站页面。", "This records renewal status. Cancel billing with the provider. Reminders appear in this app.")}</p>
        <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t("更多信息", "More details")}</summary><div className="space-y-3 pt-2">
          <Field id="sub-category" label={t("分类", "Category")}><Input className="text-base sm:text-sm" id="sub-category" list="subscription-categories" value={form.category} onChange={e => set("category", e.target.value)} placeholder={t("例如 AI 工具、影音、云服务", "e.g. AI tools, Media, Cloud")} /><datalist id="subscription-categories">{[...new Set(["AI 工具", "影音", "效率工具", "云服务", "域名", ...categories])].map(v => <option key={v} value={v} />)}</datalist></Field>
          <Field id="sub-plan" label={t("套餐", "Plan")}><Input className="text-base sm:text-sm" id="sub-plan" value={form.plan} onChange={e => set("plan", e.target.value)} /></Field>
          <Field id="sub-account" label={t("账号备注", "Account label")}><Input className="text-base sm:text-sm" id="sub-account" value={form.account} onChange={e => set("account", e.target.value)} placeholder={t("邮箱或账号昵称", "Email or account nickname")} /></Field>
          <Field id="sub-management" label={t("订阅管理链接", "Manage subscription URL")}><Input className="text-base sm:text-sm" id="sub-management" value={form.management_url} onChange={e => set("management_url", e.target.value)} /></Field>
          <Field id="sub-anchor" label={t("每月约定扣款日", "Anchor day of month")}><Input className="text-base sm:text-sm" id="sub-anchor" type="number" min="1" max="31" step="1" required value={form.anchor_day} onChange={e => set("anchor_day", e.target.value)} /></Field><p className="text-xs text-muted-foreground">{t("例如每月 31 日：2 月落在月底，3 月恢复到 31 日。", "For the 31st: February uses its last day; March returns to the 31st.")}</p>
          <Field id="sub-notes" label={t("备注", "Notes")}><Input className="text-base sm:text-sm" id="sub-notes" value={form.notes} onChange={e => set("notes", e.target.value)} /></Field>
        </div></details>{modalError}<Button type="submit" className="min-h-11 w-full">{busy ? t("保存中…", "Saving…") : t("保存订阅", "Save subscription")}</Button>
      </fieldset></form>
    </DialogContent></Dialog>
    <Dialog open={!!paying} onOpenChange={open => { if (!open && !busy) setPaying(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t("确认付款", "Confirm payment")} · {paying?.name}</DialogTitle><DialogDescription>{t("确认实际支付金额后，保存付款记录并推进到下一期。", "Record the amount actually paid, then move to the next billing date.")}</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); if (paying) void run(() => confirmPayment.mutateAsync({ subscription_id: paying.id, due_date: paying.next_date, paid_on: payment.paid_on, amount: Number(payment.amount), next_date: payment.next_date, record_expense: payment.record_expense, exchange_rate: paying.currency === "CNY" ? 1 : payment.exchange_rate ? Number(payment.exchange_rate) : undefined }), () => setPaying(null)); }}><fieldset disabled={busy} className="space-y-4">
        <Field id="pay-amount" label={`${t("实际支付金额", "Amount paid")} (${paying?.currency})`}><Input className="text-base sm:text-sm" id="pay-amount" required type="number" min="0" step="0.01" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} /></Field>
        <Field id="pay-date" label={t("付款日期", "Payment date")}><Input className="text-base sm:text-sm" id="pay-date" required type="date" max={today} value={payment.paid_on} onChange={e => setPayment({ ...payment, paid_on: e.target.value })} /></Field>
        <Field id="pay-next" label={t("下次扣款／到期日", "Next charge / expiry date")}><Input className="text-base sm:text-sm" id="pay-next" required type="date" value={payment.next_date} onChange={e => setPayment({ ...payment, next_date: e.target.value })} /></Field>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={payment.record_expense} onChange={e => setPayment({ ...payment, record_expense: e.target.checked })} />{t("同时记一笔", "Also add an expense")}</label>
        {payment.record_expense && paying?.currency !== "CNY" && <Field id="pay-rate" label={t("人民币汇率", "CNY exchange rate")}><Input className="text-base sm:text-sm" id="pay-rate" type="number" required min="0.000001" step="any" placeholder={`1 ${paying?.currency} = ? CNY`} value={payment.exchange_rate} onChange={e => setPayment({ ...payment, exchange_rate: e.target.value })} /></Field>}
        <p className="text-xs text-muted-foreground">{t("按实际账单填写。同一期付款不会重复记账，套餐原价保持不变。", "Use the actual bill. The same period cannot be paid twice; the plan price stays unchanged.")}</p>{modalError}<Button type="submit" className="min-h-11 w-full">{busy ? t("保存中…", "Saving…") : t("确认已付款", "Confirm paid")}</Button>
      </fieldset></form>
    </DialogContent></Dialog>
    <Dialog open={!!details} onOpenChange={open => { if (!open) setDetails(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{details?.name}</DialogTitle><DialogDescription>{t("订阅详情与付款记录", "Subscription details and payment history")}</DialogDescription></DialogHeader><p className="break-all text-sm text-muted-foreground">{[details?.plan, details?.account, details?.notes].filter(Boolean).join(" · ") || t("暂无补充信息", "No additional details")}</p><h3 className="font-semibold">{t("付款记录", "Payment history")}</h3>{history.isLoading ? <p>{t("加载中…", "Loading…")}</p> : history.error ? <p role="alert">{t("付款记录加载失败，请重新打开详情。", "Could not load payments. Reopen details to retry.")}</p> : !history.data?.length ? <p className="text-sm text-muted-foreground">{t("还没有确认过付款", "No confirmed payments yet")}</p> : <ul className="divide-y divide-border">{history.data.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-sm">{row.paid_on}</p><p className="text-xs text-muted-foreground">{t("对应到期日", "Billing date")} {row.period_date} · {row.finance_record_id ? t("已记账", "Expense linked") : t("仅付款记录", "Payment only")}</p></div><span className="font-mono-data">{money(row.amount, row.currency, lang)}</span></li>)}</ul>}</DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>{t("删除订阅", "Delete subscription")} · {deleting?.name}</DialogTitle><DialogDescription>{t("将删除订阅及其付款记录，已生成的记账记录会保留。如果只是停止使用，建议编辑状态为“已结束”。", "This deletes the subscription and its payment history. Finance records remain. To stop tracking an active service, consider setting its status to Ended.")}</DialogDescription></DialogHeader>{modalError}<Button variant="destructive" disabled={busy} onClick={() => deleting && void run(() => remove.mutateAsync(deleting.id), () => setDeleting(null))}>{busy ? t("删除中…", "Deleting…") : t("确认删除", "Delete permanently")}</Button></DialogContent></Dialog>
  </section>;
}
