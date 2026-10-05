import { useRef, useState, type ReactNode, type FormEvent } from "react";
import { Plus, ExternalLink, Edit2, Trash2, ReceiptText, Search, RefreshCw, Settings2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArcScope } from "@/components/arc/ArcScope";
import SegmentedControl from "@/vendor/uiarc/registry/components/segmented-control/segmented-control";
import { useLang } from "@/contexts/LanguageContext";
import { DateField } from "@/components/arc/DateField";
import { useLocalDate } from "@/hooks/useLocalDate";
import { useSubscriptions, useSubscriptionPayments, useSubscriptionMutations } from "@/hooks/useSubscriptions";
import { getSubscriptionEvent, money, subscriptionState, summarizeSubscriptions, type Subscription } from "@/lib/subscriptions";
import { normalizeSubscription } from "../../../supabase/functions/_shared/subscriptionOperations";
import { getErrorMessage } from "@/lib/errorMessage";
import { subscriptionLoadErrorMessage } from "@/lib/subscriptionQuery";

const selectClass = "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
/** A labelled row of buttons: the choice reads as the options themselves. */
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <div className="space-y-1.5"><p className="text-sm font-medium leading-none">{label}</p><ArcScope><SegmentedControl label={label} value={value} onValueChange={onChange} options={options} /></ArcScope></div>;
}
function cycle(item: Subscription, zh: boolean) {
  if (item.billing_unit === "month" && item.billing_interval === 12) return zh ? "年" : "yr";
  if (item.billing_unit === "month" && item.billing_interval === 3) return zh ? "季" : "qtr";
  return `${item.billing_interval === 1 ? "" : item.billing_interval}${item.billing_unit === "month" ? (zh ? "月" : "mo") : (zh ? "天" : "d")}`.trim();
}
function siteLabel(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
const newForm = (today: string) => ({ name: "", url: "", management_url: "", category: "", plan: "", account: "", notes: "", amount: "", currency: "CNY", billing_type: "fixed", period: "month", billing_unit: "month", billing_interval: "1", status: "active", auto_renew: true, next_date: today, anchor_day: String(Number(today.slice(-2))), reminder_days: "3" });
type FormState = ReturnType<typeof newForm>;

export function SubscriptionPanel() {
  const { t, lang } = useLang();
  const zh = lang === "zh";
  const today = useLocalDate();
  const query = useSubscriptions();
  const items = query.data ?? [];
  const { save, remove } = useSubscriptionMutations();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ongoing");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<Subscription | "new" | null>(null);
  const [form, setForm] = useState<FormState>(() => newForm(today));
  const [details, setDetails] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const history = useSubscriptionPayments(details?.id);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const summary = summarizeSubscriptions(items, today);
  const categories = [...new Set(items.map(item => item.category))].sort();
  const counts = {
    ongoing: items.filter(item => subscriptionState(item, today) !== "ended").length,
    attention: items.filter(item => getSubscriptionEvent(item, today)?.needsAttention).length,
    ended: items.filter(item => subscriptionState(item, today) === "ended").length,
    all: items.length,
  };
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
  const endSubscription = (item: Subscription) => void run(
    () => save.mutateAsync({ ...normalizeSubscription({ status: "ended" }, item as unknown as Record<string, unknown>), id: item.id, expected_updated_at: item.updated_at }),
    () => setDeleting(null),
  );
  const amounts = (values: Partial<Record<"CNY" | "USD" | "JPY", number>>) => {
    const entries = Object.entries(values);
    return entries.length ? entries.map(([currency, value]) => <span key={currency} className="block font-mono-data tabular-nums">{money(value, currency as Subscription["currency"], lang)}</span>) : <span className="text-muted-foreground">—</span>;
  };
  const estimate = (values: Partial<Record<"CNY" | "USD" | "JPY", number>>) => Object.keys(values).length > 0 && <span className="mt-1 block text-xs font-normal text-muted-foreground">≈ + {Object.entries(values).map(([currency, value]) => money(value, currency as Subscription["currency"], lang)).join(" · ")}</span>;
  /** The next date said as what happens and when. */
  const nextEvent = (item: Subscription) => {
    const event = getSubscriptionEvent(item, today);
    if (!event) return { text: t("已结束", "Ended"), tone: "" };
    if (event.overdue) return { text: t(`过期 ${-event.days} 天 · 待确认`, `${-event.days}d overdue · confirm`), tone: "tone-danger" };
    const when = event.days === 0 ? t("今天", "Today") : event.days === 1 ? t("明天", "Tomorrow") : t(`${event.days} 天后`, `In ${event.days}d`);
    const what = event.kind === "trial" ? t("试用结束", " trial ends") : event.kind === "charge" ? t("扣款", " charge") : t("到期", " expires");
    return { text: `${when}${what}`, tone: event.needsAttention ? "tone-warn" : "tone-ok" };
  };
  const modalError = error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;
  const safeLink = (url: string | null) => url && /^https?:\/\//i.test(url) ? url : undefined;
  const iconButton = "h-9 w-9 text-muted-foreground hover:text-foreground";

  if (query.isLoading) return <p role="status" className="py-12 text-center text-muted-foreground">{t("正在加载订阅…", "Loading subscriptions…")}</p>;
  if (query.error) return <div role="alert" className="space-y-3 py-8"><p>{t("加载订阅失败", "Could not load subscriptions")}</p><p className="text-sm text-muted-foreground">{subscriptionLoadErrorMessage(query.error, lang)}</p><Button variant="outline" onClick={() => query.refetch()}>{t("重试", "Retry")}</Button></div>;

  return <section aria-label={t("订阅服务", "Subscriptions")} className="space-y-5">
    <dl className="grid grid-cols-3 border-y border-border">
      <div className="py-4 pr-3">
        <dt className="flex items-center gap-1 text-xs text-muted-foreground">{t("每月", "Monthly")}
          <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger type="button" aria-label={t("计算方式", "How it's counted")} className="rounded-full p-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-3 w-3" /></TooltipTrigger>
            <TooltipContent className="max-w-64 text-xs leading-relaxed">{t("按周期折算到每月，试用不计入；≈ 为按量计费的估算。", "Cycles normalised to a month; trials excluded. ≈ marks usage estimates.")}</TooltipContent></Tooltip></TooltipProvider>
        </dt>
        <dd className="mt-1.5 text-lg font-semibold">{amounts(summary.monthly)}{estimate(summary.estimatedMonthly)}</dd>
      </div>
      <div className="border-l border-border px-3 py-4"><dt className="text-xs text-muted-foreground">{t("30 天内", "Next 30 days")}</dt><dd className="mt-1.5 text-lg font-semibold">{amounts(summary.upcoming)}{estimate(summary.estimatedUpcoming)}</dd></div>
      <div className="border-l border-border py-4 pl-3"><dt className="text-xs text-muted-foreground">{t("7 天内到期", "Due in 7 days")}</dt><dd className="mt-1.5 text-lg font-semibold font-mono-data">{summary.dueSoon}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {summary.activeCount}</span></dd></div>
    </dl>

    <div className="flex flex-wrap items-center gap-2">
      <ArcScope className="max-w-full">
        <SegmentedControl label={t("订阅状态", "Subscription status")} value={filter} onValueChange={setFilter} options={[
          { value: "ongoing", label: t("在用", "Active") },
          ...(counts.attention ? [{ value: "attention", label: t("需留意", "Attention") }] : []),
          { value: "ended", label: t("已结束", "Ended") },
          { value: "all", label: t("全部", "All") },
        ].map(option => ({ ...option, accessory: counts[option.value as keyof typeof counts] ? <span aria-hidden className={`ml-1.5 font-mono-data text-[11px] ${option.value === "attention" ? "text-cat-orange" : "opacity-60"}`}>{counts[option.value as keyof typeof counts]}</span> : undefined }))} />
      </ArcScope>
      <div className="relative min-w-0 flex-1 basis-32"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label={t("搜索订阅", "Search subscriptions")} placeholder={t("搜索", "Search")} value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-9 text-base sm:text-sm" /></div>
      {categories.length > 1 && <select aria-label={t("筛选分类", "Filter category")} value={category} onChange={e => setCategory(e.target.value)} className={selectClass.replace("w-full", "w-auto max-w-[9rem]")}><option value="all">{t("全部分类", "All categories")}</option>{categories.map(value => <option key={value}>{value}</option>)}</select>}
      <Button className="min-h-11" onClick={() => openEditor()}><Plus className="h-4 w-4 sm:mr-1.5" /><span className="sr-only sm:not-sr-only">{t("添加订阅", "Add subscription")}</span></Button>
    </div>

    {visible.length === 0 ? <div className="py-14 text-center"><ReceiptText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{items.length === 0 ? t("还没有订阅", "No subscriptions yet") : t("没有符合条件的订阅", "No matching subscriptions")}</p>{items.length === 0 && <Button variant="outline" className="mt-4 min-h-11" onClick={() => openEditor()}><Plus className="mr-1.5 h-4 w-4" />{t("添加第一项", "Add the first one")}</Button>}</div> : <ul className="border-t border-border">
      {visible.map(item => {
        const next = nextEvent(item);
        const meta = [item.plan, item.account, item.url ? siteLabel(item.url) : null].filter(Boolean).join(" · ");
        return <li key={item.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-border px-1.5 py-3 transition-colors hover:bg-muted/45 sm:grid-cols-[minmax(0,1fr)_8.5rem_9.5rem_auto]">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2"><button onClick={() => { setDetails(item); setError(""); }} className="row-title truncate text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.name}</button><span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{item.category}</span></div>
            {meta && <p className="row-meta truncate">{meta}</p>}
          </div>
          <p className="whitespace-nowrap text-right font-mono-data text-sm font-semibold tabular-nums sm:text-left">{item.billing_type === "usage" && <span className="mr-0.5 font-normal text-muted-foreground" title={t("按量估算", "Usage estimate")}>≈</span>}{money(item.amount, item.currency, lang)}<span className="font-normal text-muted-foreground"> / {cycle(item, zh)}</span></p>
          <div className="flex min-w-0 items-center gap-2 sm:block">
            <p className={`status-text text-sm ${next.tone}`}>{next.text}</p>
            <p className="flex items-center gap-1.5 whitespace-nowrap font-mono-data text-xs text-muted-foreground sm:mt-0.5">{item.next_date.slice(5)}{item.auto_renew && item.status !== "ended" && <span role="img" aria-label={t("自动续费", "Auto-renews")} title={t("自动续费", "Auto-renews")}><RefreshCw className="h-3 w-3" aria-hidden /></span>}</p>
          </div>
          <div className="flex items-center justify-end gap-0.5">
            <span className={`flex items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`}>
            {safeLink(item.url) && <Button asChild variant="ghost" size="icon" className={iconButton}><a href={item.url!} target="_blank" rel="noopener noreferrer" aria-label={`${t("打开网站", "Open website")} ${item.name}`}><ExternalLink className="h-4 w-4" /></a></Button>}
            {safeLink(item.management_url) && <Button asChild variant="ghost" size="icon" className={iconButton}><a href={item.management_url!} target="_blank" rel="noopener noreferrer" aria-label={`${t("管理订阅", "Manage subscription")} ${item.name}`}><Settings2 className="h-4 w-4" /></a></Button>}
            <Button variant="ghost" size="icon" className={iconButton} aria-label={`${t("编辑", "Edit")} ${item.name}`} onClick={() => openEditor(item)}><Edit2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className={`${iconButton} hover:text-destructive`} aria-label={`${t("删除", "Delete")} ${item.name}`} onClick={() => { setDeleting(item); setError(""); }}><Trash2 className="h-4 w-4" /></Button>
            </span>
          </div>
        </li>;
      })}
    </ul>}

    <Dialog open={editor !== null} onOpenChange={open => { if (!open && !busy) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editor === "new" ? t("添加订阅", "Add subscription") : t("编辑订阅", "Edit subscription")}</DialogTitle><DialogDescription className="sr-only">{t("服务、价格、周期与下次日期", "Service, price, cycle and next date")}</DialogDescription></DialogHeader>
      <form onSubmit={saveForm}><fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="sub-name" label={t("服务名称 *", "Service name *")}><Input id="sub-name" required maxLength={200} value={form.name} onChange={e => set("name", e.target.value)} className="text-base sm:text-sm" autoFocus /></Field>
          <Field id="sub-url" label={t("服务网址", "Website URL")}><Input id="sub-url" placeholder="example.com" value={form.url} onChange={e => set("url", e.target.value)} className="text-base sm:text-sm" /></Field>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3"><Field id="sub-amount" label={t("价格 *", "Price *")}><Input id="sub-amount" type="number" required min="0" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} className="font-mono-data text-base sm:text-sm" /></Field><Field id="sub-currency" label={t("币种", "Currency")}><select id="sub-currency" className={selectClass} value={form.currency} onChange={e => set("currency", e.target.value)}>{["CNY", "USD", "JPY"].map(v => <option key={v}>{v}</option>)}</select></Field></div>
        <Choice label={t("付费周期", "Billing cycle")} value={form.period} onChange={v => set("period", v)} options={[{ value: "month", label: t("月付", "Monthly") }, { value: "quarter", label: t("季付", "Quarterly") }, { value: "year", label: t("年付", "Yearly") }, { value: "custom", label: t("自定义", "Custom") }]} />
        {form.period === "custom" && <div className="grid grid-cols-2 gap-3"><Field id="sub-interval" label={t("每隔", "Every")}><Input className="text-base sm:text-sm" id="sub-interval" type="number" required min="1" max={form.billing_unit === "month" ? 120 : 3660} step="1" value={form.billing_interval} onChange={e => set("billing_interval", e.target.value)} /></Field><Field id="sub-unit" label={t("周期单位", "Cycle unit")}><select id="sub-unit" className={selectClass} value={form.billing_unit} onChange={e => set("billing_unit", e.target.value)}><option value="month">{t("个月", "months")}</option><option value="day">{t("天", "days")}</option></select></Field></div>}
        <Choice label={t("计费方式", "Pricing")} value={form.billing_type} onChange={v => set("billing_type", v)} options={[{ value: "fixed", label: t("固定", "Fixed") }, { value: "usage", label: t("按量估算", "Usage") }]} />
        <Field id="sub-date" label={t("下次扣款／到期日 *", "Next charge / expiry date *")}><DateField id="sub-date" required label={t("下次扣款／到期日 *", "Next charge / expiry date *")} value={form.next_date} onChange={next_date => setForm(prev => ({ ...prev, next_date, anchor_day: next_date ? String(Number(next_date.slice(-2))) : prev.anchor_day }))} /></Field>
        <Choice label={t("状态", "Status")} value={form.status} onChange={v => set("status", v)} options={[{ value: "active", label: t("使用中", "Active") }, { value: "trial", label: t("试用中", "Trial") }, { value: "ended", label: t("已结束", "Ended") }]} />
        <Choice label={t("提醒", "Reminder")} value={form.reminder_days} onChange={v => set("reminder_days", v)} options={[{ value: "off", label: t("不提醒", "Off") }, { value: "0", label: t("当天", "Same day") }, { value: "3", label: t("提前 3 天", "3 days") }, { value: "7", label: t("提前 7 天", "7 days") }, ...(!["off", "0", "3", "7"].includes(form.reminder_days) ? [{ value: form.reminder_days, label: t(`提前 ${form.reminder_days} 天`, `${form.reminder_days} days`) }] : [])]} />
        <div className="flex min-h-11 items-center justify-between gap-3"><Label htmlFor="sub-renew">{t("自动续费", "Auto-renewal")}</Label><Switch id="sub-renew" checked={form.auto_renew} onCheckedChange={v => set("auto_renew", v)} /></div>
        <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t("更多信息", "More details")}</summary><div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Field id="sub-category" label={t("分类", "Category")}><Input className="text-base sm:text-sm" id="sub-category" list="subscription-categories" value={form.category} onChange={e => set("category", e.target.value)} placeholder={t("AI 工具", "AI tools")} /><datalist id="subscription-categories">{[...new Set(["AI 工具", "影音", "效率工具", "云服务", "域名", ...categories])].map(v => <option key={v} value={v} />)}</datalist></Field>
          <Field id="sub-plan" label={t("套餐", "Plan")}><Input className="text-base sm:text-sm" id="sub-plan" value={form.plan} onChange={e => set("plan", e.target.value)} /></Field>
          <Field id="sub-account" label={t("账号备注", "Account label")}><Input className="text-base sm:text-sm" id="sub-account" value={form.account} onChange={e => set("account", e.target.value)} placeholder={t("邮箱或昵称", "Email or nickname")} /></Field>
          <Field id="sub-anchor" label={t("每月扣款日", "Billing day of month")}><Input className="text-base sm:text-sm" id="sub-anchor" type="number" min="1" max="31" step="1" required value={form.anchor_day} onChange={e => set("anchor_day", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field id="sub-management" label={t("订阅管理链接", "Manage subscription URL")}><Input className="text-base sm:text-sm" id="sub-management" value={form.management_url} onChange={e => set("management_url", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field id="sub-notes" label={t("备注", "Notes")}><Input className="text-base sm:text-sm" id="sub-notes" value={form.notes} onChange={e => set("notes", e.target.value)} /></Field></div>
        </div></details>{modalError}<Button type="submit" className="min-h-11 w-full">{busy ? t("保存中…", "Saving…") : t("保存订阅", "Save subscription")}</Button>
      </fieldset></form>
    </DialogContent></Dialog>

    <Dialog open={!!details} onOpenChange={open => { if (!open) setDetails(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{details?.name}</DialogTitle><DialogDescription className="sr-only">{t("订阅详情与付款记录", "Subscription details and payment history")}</DialogDescription></DialogHeader>
      {[details?.plan, details?.account, details?.notes].some(Boolean) && <p className="break-all text-sm text-muted-foreground">{[details?.plan, details?.account, details?.notes].filter(Boolean).join(" · ")}</p>}
      <h3 className="text-sm font-semibold">{t("付款记录", "Payment history")}</h3>
      {history.isLoading ? <p className="text-sm text-muted-foreground">{t("加载中…", "Loading…")}</p> : history.error ? <p role="alert" className="text-sm">{t("付款记录加载失败，请重新打开。", "Could not load payments. Reopen to retry.")}</p> : !history.data?.length ? <p className="text-sm text-muted-foreground">{t("暂无付款记录", "No payments yet")}</p> : <ul className="row-list">{history.data.map(row => <li key={row.id} className="row-item flex items-center justify-between gap-3 py-2.5"><div className="row-main"><p className="font-mono-data text-sm">{row.paid_on}</p><p className="row-meta">{t("账期", "Period")} {row.period_date}{row.finance_record_id && <> · <span role="img" aria-label={t("已记账", "Expense linked")} title={t("已记账", "Expense linked")}><ReceiptText className="inline h-3 w-3 align-[-2px]" aria-hidden /></span></>}</p></div><span className="font-mono-data text-sm font-semibold">{money(row.amount, row.currency, lang)}</span></li>)}</ul>}
    </DialogContent></Dialog>

    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>{t("删除订阅", "Delete subscription")} · {deleting?.name}</DialogTitle><DialogDescription>{t("付款记录一并删除，已记的账保留。", "Payment history is deleted; finance records stay.")}</DialogDescription></DialogHeader>{modalError}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {deleting && deleting.status !== "ended" && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => endSubscription(deleting)}>{t("改为已结束", "Mark as ended")}</Button>}
        <Button variant="destructive" className="min-h-11" disabled={busy} onClick={() => deleting && void run(() => remove.mutateAsync(deleting.id), () => setDeleting(null))}>{busy ? t("删除中…", "Deleting…") : t("确认删除", "Delete permanently")}</Button>
      </div>
    </DialogContent></Dialog>
  </section>;
}
