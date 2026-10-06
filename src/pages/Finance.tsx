import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { differenceInCalendarDays, endOfMonth, endOfWeek, format, max, min, startOfMonth, startOfWeek } from "date-fns";
import { Bus, ChevronDown, Edit2, FileText, Gamepad2, Gem, HeartPulse, Home, MoreHorizontal, Monitor, Plus, Shirt, ShoppingBag, Smartphone, Trash2, UtensilsCrossed, BookOpen, Wallet } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { ArcScope } from "@/components/arc/ArcScope";
import { DateField } from "@/components/arc/DateField";
import { ShareDonut, TrendLine } from "@/components/arc/ShareCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { useFinanceByMonth, financeHooks, useSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { convertExpense } from "@/lib/financeConversion";
import ActionButton from "@/vendor/uiarc/registry/components/action-button/action-button";
import AnimatedCounter from "@/vendor/uiarc/registry/components/animated-counter/animated-counter";
import BottomSheet from "@/vendor/uiarc/registry/components/bottom-sheet/bottom-sheet";
import { Combobox } from "@/vendor/uiarc/registry/components/combobox/combobox";
import ConfirmMorph from "@/vendor/uiarc/registry/components/confirm-morph/confirm-morph";
import DateRangePicker, { type DateRange } from "@/vendor/uiarc/registry/components/date-range-picker/date-range-picker";
import { NumberField } from "@/vendor/uiarc/registry/components/number-field/number-field";

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  "餐饮": UtensilsCrossed, "日用": ShoppingBag, "交通": Bus,
  "住房": Home, "通讯/订阅": Smartphone, "医疗": HeartPulse,
  "服饰": Shirt, "娱乐": Gamepad2, "学习": BookOpen,
  "电子": Monitor, "大额": Gem, "税费": FileText, "其他": MoreHorizontal,
};

const CATEGORIES_ZH = [
  "餐饮", "日用", "交通", "住房", "通讯/订阅", "医疗", "服饰",
  "娱乐", "学习", "电子", "大额", "税费", "其他",
] as const;

const CATEGORY_COLORS = [
  "hsl(var(--finance-pie-orange))", "hsl(var(--finance-pie-teal))", "hsl(var(--finance-pie-purple))", "hsl(var(--finance-pie-green))",
  "hsl(var(--finance-pie-blue))", "hsl(var(--finance-pie-yellow))", "hsl(var(--finance-pie-red))",
];

const CATEGORIES_EN: Record<string, string> = {
  "餐饮": "Food", "日用": "Daily", "交通": "Transport", "住房": "Housing",
  "通讯/订阅": "Subscriptions", "医疗": "Medical", "服饰": "Clothing",
  "娱乐": "Entertainment", "学习": "Education", "电子": "Electronics",
  "大额": "Major", "税费": "Tax", "其他": "Other",
};

interface FinanceRecord {
  id: string;
  name: string;
  category: string;
  amount: number | string;
  currency: string;
  amount_cny: number | string;
  exchange_rate?: number | string | null;
  date: string;
  notes?: string | null;
}

const toLocalISODate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayISO = () => toLocalISODate(new Date());
const newForm = () => ({ name: "", category: "餐饮", amount: "", currency: "JPY", date: todayISO(), notes: "" });

function getMonthWeek(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const start = max([startOfWeek(d, { weekStartsOn: 1 }), startOfMonth(d)]);
  const end = min([endOfWeek(d, { weekStartsOn: 1 }), endOfMonth(d)]);
  return {
    key: toLocalISODate(start),
    label: `${format(start, "MM/dd")} - ${format(end, "MM/dd")}`,
    days: differenceInCalendarDays(end, start) + 1,
  };
}

export default function FinancePage() {
  const { t, lang } = useLang();
  const location = useLocation();
  const openCreateFromDashboard = new URLSearchParams(location.search).get("new") === "1";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dialogOpen, setDialogOpen] = useState(openCreateFromDashboard);
  const [editingItem, setEditingItem] = useState<FinanceRecord | null>(null);
  const [form, setForm] = useState(newForm);
  const [saving, setSaving] = useState(false);
  const [saveCommitted, setSaveCommitted] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [scrub, setScrub] = useState<{ value: number; label: string } | null>(null);
  const [usdRate, setUsdRate] = useState("");
  const saveInFlight = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { toast } = useToast();

  const { data: records = [] } = useFinanceByMonth(year, month);
  const { data: settings } = useSettings();
  const createMutation = financeHooks.useCreate();
  const updateMutation = financeHooks.useUpdate();
  const deleteMutation = financeHooks.useDelete();

  const targetMonth = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = useMemo<FinanceRecord[]>(() => (records as FinanceRecord[]).filter(record => record.date.startsWith(`${targetMonth}-`)), [records, targetMonth]);
  const selectedRecords = useMemo<FinanceRecord[]>(() => {
    if (!dateRange) return monthRecords;
    const start = toLocalISODate(dateRange.start), end = toLocalISODate(dateRange.end);
    return monthRecords.filter(record => record.date >= start && record.date <= end);
  }, [dateRange, monthRecords]);

  const budget = settings?.monthly_budget || 5000;
  const exchangeRate = settings?.exchange_rate_jpy_to_cny || 0.048;
  const conversion = convertExpense(Number(form.amount), form.currency, form.currency === "USD" ? Number(usdRate) : exchangeRate, editingItem);
  const isSaving = saving || createMutation.isPending || updateMutation.isPending;
  const totalCny = selectedRecords.reduce((sum, record) => sum + Number(record.amount_cny), 0);
  const budgetProgress = Math.min(100, (totalCny / budget) * 100);

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    selectedRecords.forEach(record => totals.set(record.category, (totals.get(record.category) ?? 0) + Number(record.amount_cny)));
    return [...totals.entries()].map(([name, value]) => {
      const index = Math.max(0, CATEGORIES_ZH.indexOf(name as (typeof CATEGORIES_ZH)[number]));
      return {
        key: name,
        label: lang === "zh" ? name : (CATEGORIES_EN[name] || name),
        value: Number(value.toFixed(2)),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      };
    });
  }, [lang, selectedRecords]);
  const pinnedCategory = activeCategory && categoryData.some((item) => item.key === activeCategory) ? activeCategory : null;
  const scopedRecords = useMemo(
    () => (pinnedCategory ? selectedRecords.filter((record) => record.category === pinnedCategory) : selectedRecords),
    [pinnedCategory, selectedRecords],
  );
  const headlineTotal = scrub?.value ?? scopedRecords.reduce((sum, record) => sum + Number(record.amount_cny), 0);
  const pinnedLabel = categoryData.find((item) => item.key === pinnedCategory)?.label;

  const dailyData = useMemo(() => {
    const totals = new Map<string, number>();
    scopedRecords.forEach(record => totals.set(record.date, (totals.get(record.date) ?? 0) + Number(record.amount_cny)));
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
      key: date,
      label: format(new Date(`${date}T00:00:00`), "yyyy/MM/dd"),
      axisLabel: format(new Date(`${date}T00:00:00`), "MM/dd"),
      values: { spending: Number(value.toFixed(2)) },
    }));
  }, [scopedRecords]);

  const weeklyGroups = useMemo(() => {
    const groups = new Map<string, { label: string; days: number; items: FinanceRecord[] }>();
    scopedRecords.forEach(record => {
      const { key, label, days } = getMonthWeek(record.date);
      const group = groups.get(key) ?? { label, days, items: [] };
      group.items.push(record);
      groups.set(key, group);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [scopedRecords]);

  useLayoutEffect(() => {
    if (dialogOpen || !returnFocusRef.current) return;
    returnFocusRef.current.focus();
    returnFocusRef.current = null;
  }, [dialogOpen]);

  const resetForm = () => {
    saveInFlight.current = false;
    setSaveCommitted(false);
    setEditingItem(null);
    setUsdRate("");
    setForm(newForm());
  };

  const openEditor = (item: FinanceRecord | null, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    saveInFlight.current = false;
    setSaveCommitted(false);
    setEditingItem(item);
    setUsdRate("");
    setForm(item ? {
      name: item.name,
      category: item.category,
      amount: String(item.amount),
      currency: item.currency,
      date: item.date,
      notes: item.notes || "",
    } : newForm());
    setDialogOpen(true);
  };

  const closeEditor = (open: boolean) => {
    if (isSaving && !open) return;
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleSave = async () => {
    if (saveInFlight.current || isSaving || saveCommitted) {
      throw new Error("A save is already in progress.");
    }
    if (!form.name.trim() || !form.amount || !form.date || (form.currency === "USD" && editingItem?.currency !== "USD" && !usdRate)) {
      toast({ title: t("请填写必填字段", "Please fill required fields"), variant: "destructive" });
      throw new Error("Required fields are missing.");
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(conversion.amountCny) || !Number.isFinite(conversion.rate) || conversion.rate <= 0) {
      toast({ title: t("请输入大于 0 的有效金额", "Enter a valid amount greater than zero"), variant: "destructive" });
      throw new Error("The expense amount or exchange rate is invalid.");
    }

    saveInFlight.current = true;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category, amount, currency: form.currency,
        amount_cny: Number(conversion.amountCny.toFixed(2)), exchange_rate: conversion.rate,
        date: form.date, notes: form.notes || null,
      };
      const persisted = editingItem
        ? await updateMutation.mutateAsync({ id: editingItem.id, ...payload })
        : await createMutation.mutateAsync(payload);
      if (persisted && typeof persisted === "object" && "id" in persisted) {
        setEditingItem(persisted as FinanceRecord);
      }
      setSaveCommitted(true);
    } catch (error: unknown) {
      saveInFlight.current = false;
      toast({ title: t("保存失败", "Save failed"), description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (offset: number) => {
    const next = new Date(year, month - 1 + offset, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setDateRange(null);
  };

  const recordForm = (
    <>
      <fieldset disabled={saveCommitted} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <div>
          <label htmlFor="fin-name" className="mb-1 block text-sm font-medium">{t("名称", "Name")} *</label>
          <input id="fin-name" className="ledger-field" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
        </div>
        <Combobox
          id="fin-category"
          label={`${t("分类", "Category")} *`}
          value={form.category}
          onValueChange={category => setForm(current => ({ ...current, category }))}
          options={CATEGORIES_ZH.map(category => ({ value: category, label: lang === "zh" ? category : (CATEGORIES_EN[category] || category) }))}
          placeholder={t("搜索或选择分类", "Search or select a category")}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="fin-amount"
            label={`${t("金额", "Amount")} *`}
            value={Number(form.amount) || 0}
            onValueChange={amount => setForm(current => ({ ...current, amount: String(amount) }))}
            min={-1_000_000_000_000}
            step={form.currency === "JPY" ? 1 : 0.01}
            prefix={form.currency === "USD" ? "$" : "¥"}
            locale={lang === "zh" ? "zh-CN" : "en-US"}
            description={form.currency === "JPY" ? t("日元按整数记录", "JPY is entered in whole units") : undefined}
          />
          <div>
            <label htmlFor="fin-currency" className="mb-1 block text-sm font-medium">{t("货币", "Currency")}</label>
            <select
              id="fin-currency"
              className="ledger-field"
              value={form.currency}
              onChange={event => setForm(current => ({
                ...current,
                currency: event.target.value,
                amount: event.target.value === "JPY" && current.amount ? String(Math.round(Number(current.amount))) : current.amount,
              }))}
            >
              <option value="CNY">CNY ¥</option>
              <option value="JPY">JPY ¥</option>
              <option value="USD">USD $</option>
            </select>
          </div>
        </div>
        {form.currency === "USD" && editingItem?.currency !== "USD" && (
          <div>
            <label htmlFor="fin-usd-rate" className="mb-1 block text-sm font-medium">{t("人民币汇率（1 USD）", "CNY rate per USD")} *</label>
            <input id="fin-usd-rate" className="ledger-field" type="number" min="0.000001" step="any" value={usdRate} onChange={event => setUsdRate(event.target.value)} placeholder={t("填写实际兑换汇率", "Actual exchange rate")} />
          </div>
        )}
        {form.currency !== "CNY" && form.amount && (
          <p className="text-xs text-muted-foreground">≈ ¥{Number.isFinite(conversion.amountCny) ? conversion.amountCny.toFixed(2) : "—"} CNY ({t("汇率", "Rate")}: {conversion.rate})</p>
        )}
        <div>
          <label htmlFor="fin-date" className="mb-1 block text-sm font-medium">{t("日期", "Date")} *</label>
          <DateField id="fin-date" label={t("日期", "Date")} required value={form.date} onChange={(date) => setForm(current => ({ ...current, date }))} />
        </div>
        <div>
          <label htmlFor="fin-notes" className="mb-1 block text-sm font-medium">{t("备注", "Notes")}</label>
          <input id="fin-notes" className="ledger-field" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} />
        </div>
      </fieldset>
      {saveCommitted && <p role="status" className="pb-1 text-sm text-muted-foreground">{t("记录已保存，关闭后可继续记账", "Record saved. Close this sheet to continue.")}</p>}
      <ActionButton
        label={t("保存", "Save")}
        pendingLabel={t("保存中…", "Saving…")}
        successLabel={t("已保存", "Saved")}
        onAction={handleSave}
        onActionError={() => {}}
        disabled={saveCommitted}
        className="w-full justify-center"
      />
    </>
  );

  return (
    <AppLayout title={t("记账", "Finance")}>
      <>
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" aria-label={t("上个月", "Previous month")} onClick={() => changeMonth(-1)}>←</Button>
              <span className="min-w-28 text-center text-sm font-medium" aria-live="polite">
                {lang === "zh" ? `${year}年${month}月` : new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <Button variant="secondary" size="sm" aria-label={t("下个月", "Next month")} onClick={() => changeMonth(1)}>→</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ArcScope className="inline-flex">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  label={t("筛选日期范围", "Filter date range")}
                  placeholder={t("全部日期", "All dates")}
                  locale={lang === "zh" ? "zh-CN" : "en-US"}
                  weekStartsOn={1}
                  months={1}
                />
              </ArcScope>
              {dateRange && <Button variant="ghost" size="sm" aria-label={t("清除日期筛选", "Clear date filter")} onClick={() => setDateRange(null)}>{t("清除", "Clear")}</Button>}
              <Button size="sm" className="h-9" onClick={event => openEditor(null, event.currentTarget)}><Plus className="h-4 w-4" />{t("记一笔", "Add Expense")}</Button>
            </div>
          </header>

          <section className="life-stage grid items-start gap-x-6 gap-y-4 xl:grid-cols-[14rem_32rem_minmax(0,1fr)]" aria-label={t("支出概览", "Spending overview")}>
            <div>
              <div>
                <p className="mb-1 text-sm text-muted-foreground">
                  {scrub?.label ?? pinnedLabel ?? t(dateRange ? "所选支出" : "本月支出", dateRange ? "Selected spending" : "Monthly spending")}
                </p>
                <ArcScope className="inline-flex">
                  <AnimatedCounter value={headlineTotal} prefix="¥" decimals={2} locale={lang === "zh" ? "zh-CN" : "en-US"} />
                </ArcScope>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pinnedCategory
                    ? t(`${scopedRecords.length} 笔${pinnedLabel}`, `${scopedRecords.length} ${pinnedLabel}`)
                    : `${selectedRecords.length} ${t("笔记录", "records")}`}
                </p>
                {pinnedCategory && (
                  <button type="button" className="mt-1 min-h-8 text-sm text-foreground underline underline-offset-4" onClick={() => setActiveCategory(null)}>
                    {t("查看全部分类", "Show every category")}
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t(dateRange ? "筛选额 / 月预算" : "本月预算", dateRange ? "Selected / monthly budget" : "Monthly budget")}</span>
                  <span>¥{budget.toLocaleString()}</span>
                </div>
                <Progress value={budgetProgress} className="h-2" aria-label={t("预算使用进度", "Budget used")} />
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium">{t("分类占比", "Category breakdown")}</h2>
              <ShareDonut
                data={categoryData}
                label={t("分类支出构成", "Spending by category")}
                unit="CNY"
                formatValue={value => `¥${value.toFixed(2)}`}
                totalLabel={t("合计", "Total")}
                otherLabel={t("其他", "Other")}
                emptyLabel={t("所选范围暂无数据", "No spending in this range")}
                activeKey={pinnedCategory}
                onActiveChange={setActiveCategory}
                size={208}
                thickness={22}
              />
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium">{t("每日支出趋势", "Daily spending trend")}</h2>
              <TrendLine
                data={dailyData}
                series={[{ key: "spending", label: pinnedLabel ?? t("支出", "Spending"), color: "hsl(var(--cat-orange))", area: true }]}
                label={t("每日支出趋势", "Daily spending trend")}
                unit="CNY"
                height={220}
                formatValue={value => `¥${value.toFixed(2)}`}
                formatTick={value => `¥${value.toFixed(0)}`}
                emptyLabel={t("所选范围暂无数据", "No spending in this range")}
                legend={false}
                categoryLabel={t("日期", "Date")}
                onActiveChange={(_index, datum) => {
                  const value = datum?.values.spending;
                  setScrub(datum && typeof value === "number" ? { value, label: datum.label } : null);
                }}
              />
            </div>
          </section>

          <section className="space-y-2" aria-label={t("每周明细", "Weekly records")}>
            {weeklyGroups.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={t("当前范围暂无记录", "No records in this range")}
                hint={t("记下第一笔支出，图表和周报会随之生成。", "Add your first expense and the charts fill in from there.")}
                action={<Button size="sm" className="h-9" onClick={event => openEditor(null, event.currentTarget)}><Plus className="h-4 w-4" />{t("记一笔", "Add Expense")}</Button>}
              />
            ) : weeklyGroups.map(([key, group]) => {
              const weekTotal = group.items.reduce((sum, record) => sum + Number(record.amount_cny), 0);
              return (
                <Collapsible key={key}>
                  <CollapsibleTrigger className="w-full text-left">
                    <Card className="transition-colors hover:border-primary/30">
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium">{group.label}</span>
                          {group.days < 7 && <span className="text-xs font-normal text-muted-foreground">{t(`${group.days} 天`, `${group.days} ${group.days === 1 ? "day" : "days"}`)}</span>}
                        </span>
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-primary">¥{weekTotal.toFixed(2)}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </span>
                      </CardContent>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pl-2 pt-1">
                    {group.items.map(record => {
                      const CategoryIcon = CATEGORY_ICON_MAP[record.category];
                      return (
                        <Card key={record.id}>
                          <CardContent className="flex items-center justify-between gap-2 p-2 px-3">
                            <div className="flex min-w-0 items-center gap-2">
                              {CategoryIcon && <CategoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <span className="truncate text-sm">{record.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(`${record.date}T00:00:00`), "MM/dd")}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <div className="mr-1 text-right">
                                <span className="text-sm font-medium">¥{Number(record.amount_cny).toFixed(2)}</span>
                                {record.currency !== "CNY" && <span className="ml-1 text-xs text-muted-foreground">({Number(record.amount).toFixed(record.currency === "JPY" ? 0 : 2)} {record.currency})</span>}
                              </div>
                              <Button variant="ghost" size="icon" aria-label={t("编辑记录", "Edit record")} className="h-8 w-8" onClick={event => { event.stopPropagation(); openEditor(record, event.currentTarget); }}><Edit2 className="h-4 w-4" /></Button>
                              <ArcScope className="inline-flex">
                                <ConfirmMorph
  className="confirm-quiet"
                                  tone="danger"
                                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                  label={<span className="sr-only">{t("删除记录", "Delete record")}</span>}
                                  prompt={t("删除这条记录？", "Delete this record?")}
                                  confirmLabel={t("删除", "Delete")}
                                  cancelLabel={t("取消", "Cancel")}
                                  doneLabel={t("已删除", "Deleted")}
                                  onConfirm={() => deleteMutation.mutateAsync(record.id)}
                                />
                              </ArcScope>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </section>
        </main>

        {/* Bottom sheet everywhere: opens at the tall detent, no drag needed to see the form. */}
        <BottomSheet
          open={dialogOpen}
          onOpenChange={closeEditor}
          title={`${editingItem ? t("编辑", "Edit") : t("新增", "New")} ${t("记录", "Record")}`}
          description={t("记录名称、金额、分类和日期。", "Record the name, amount, category, and date.")}
          detents={[0.64, 0.92]}
          initialDetent={1}
          className="arc-runtime"
          closeLabel={t("关闭", "Close")}
        >
          {recordForm}
        </BottomSheet>
      </>
    </AppLayout>
  );
}
