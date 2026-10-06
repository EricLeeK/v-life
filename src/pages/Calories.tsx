import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { ArcScope } from "@/components/arc/ArcScope";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, Coffee, Sun, Moon, Cookie, Dumbbell } from "lucide-react";
import { calorieHooks, useSettings } from "@/hooks/useData";
import { WeeklyCalorieChart, MealDistributionChart } from "@/components/charts/CalorieCharts";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import ActionButton from "@/vendor/uiarc/registry/components/action-button/action-button";
import AnimatedCounter from "@/vendor/uiarc/registry/components/animated-counter/animated-counter";
import BottomSheet from "@/vendor/uiarc/registry/components/bottom-sheet/bottom-sheet";
import { Combobox } from "@/vendor/uiarc/registry/components/combobox/combobox";
import ConfirmMorph from "@/vendor/uiarc/registry/components/confirm-morph/confirm-morph";
import { NumberField } from "@/vendor/uiarc/registry/components/number-field/number-field";
import SegmentedControl from "@/vendor/uiarc/registry/components/segmented-control/segmented-control";

const MEAL_TYPE_ICONS: Record<string, React.ElementType> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
  exercise: Dumbbell,
};

const MEAL_TYPES = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
  { key: "exercise", label: "运动" },
] as const;

const toISODate = (date: Date) => date.toISOString().split("T")[0];

export default function CaloriesPage() {
  const { t, lang } = useLang();
  const locale = lang === "zh" ? zhCN : undefined;
  const mealLabels: Record<string, string> = {
    breakfast: t("早餐", "Breakfast"),
    lunch: t("午餐", "Lunch"),
    dinner: t("晚餐", "Dinner"),
    snack: t("加餐", "Snack"),
    exercise: t("运动", "Exercise"),
  };
  const today = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeMeal, setActiveMeal] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ food_name: "", calories: "", meal_type: "lunch", notes: "" });
  const { toast } = useToast();

  const { data: allCalorieRecords = [] } = calorieHooks.useList();
  const { data: settings } = useSettings();
  const createMutation = calorieHooks.useCreate();
  const updateMutation = calorieHooks.useUpdate();
  const deleteMutation = calorieHooks.useDelete();

  const navDays = useMemo(() => Array.from({ length: 7 }, (_, index) => toISODate(addDays(subDays(new Date(), 6), index))), []);
  const dayOptions = useMemo(() => navDays.map((date) => ({
    value: date,
    label: format(parseISO(date), lang === "zh" ? "EEE d" : "EEE d", { locale }),
  })), [navDays, lang, locale]);

  const records = useMemo(() => (allCalorieRecords as any[])
    .filter((record) => record.date === selectedDate)
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))), [allCalorieRecords, selectedDate]);

  const weeklyRecords = useMemo(() => (allCalorieRecords as any[])
    .filter((record) => navDays.includes(record.date))
    .map((record) => ({ date: record.date, calories: record.calories, meal_type: record.meal_type })), [allCalorieRecords, navDays]);

  const target = settings?.calorie_target || 2000;
  const foodCalories = records.filter((record) => record.meal_type !== "exercise").reduce((sum: number, record) => sum + record.calories, 0);
  const exerciseCalories = records.filter((record) => record.meal_type === "exercise").reduce((sum: number, record) => sum + record.calories, 0);
  const totalCalories = foodCalories - exerciseCalories;
  const pinnedMeal = activeMeal && records.some((record) => record.meal_type === activeMeal) ? activeMeal : null;
  const remaining = target - totalCalories;

  useEffect(() => {
    if (!pinnedMeal) return;
    document.getElementById(`meal-${pinnedMeal}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pinnedMeal]);

  const openSheet = (mealType: string, item?: any) => {
    setEditingItem(item ?? null);
    setForm(item
      ? { food_name: item.food_name, calories: String(item.calories), meal_type: item.meal_type, notes: item.notes || "" }
      : { food_name: "", calories: "", meal_type: mealType, notes: "" });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const calories = Number(form.calories);
    if (!form.food_name.trim() || !Number.isFinite(calories) || calories <= 0) {
      toast({ title: t("请填写食物名称和热量", "Please fill food name and calories"), variant: "destructive" });
      throw new Error("Required calorie fields are missing.");
    }
    const payload = { food_name: form.food_name.trim(), calories, meal_type: form.meal_type, date: selectedDate, notes: form.notes || null };
    if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
    else await createMutation.mutateAsync(payload);
    setSheetOpen(false);
    setEditingItem(null);
    setForm({ food_name: "", calories: "", meal_type: "lunch", notes: "" });
  };

  const calorieForm = (
    <div className="space-y-4">
      <div>
        <label htmlFor="cal-food-name" className="mb-1 block text-sm font-medium">{t("食物名称", "Food Name")} *</label>
        <input id="cal-food-name" className="ledger-field" value={form.food_name} onChange={(event) => setForm({ ...form, food_name: event.target.value })} />
      </div>
      <NumberField
        id="cal-calories"
        label={`${t("热量", "Calories")} *`}
        value={Number(form.calories) || 0}
        onValueChange={(calories) => setForm((current) => ({ ...current, calories: String(calories) }))}
        min={0}
        step={1}
        suffix=" kcal"
        scrub
        locale={lang === "zh" ? "zh-CN" : "en-US"}
      />
      <Combobox
        id="cal-meal-type"
        label={t("餐次", "Meal Type")}
        value={form.meal_type}
        onValueChange={(meal) => setForm((current) => ({ ...current, meal_type: meal }))}
        options={MEAL_TYPES.map((meal) => ({ value: meal.key, label: mealLabels[meal.key] || meal.label }))}
        placeholder={t("选择餐次", "Choose a meal")}
      />
      <div>
        <label htmlFor="cal-notes" className="mb-1 block text-sm font-medium">{t("备注", "Notes")}</label>
        <input id="cal-notes" className="ledger-field" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </div>
      <ActionButton
        label={t("保存", "Save")}
        pendingLabel={t("保存中…", "Saving…")}
        successLabel={t("已保存", "Saved")}
        onAction={handleSave}
        onActionError={() => {}}
        className="w-full justify-center"
      />
    </div>
  );

  return (
    <AppLayout title={t("热量记录", "Calories")}>
      <div className="space-y-4">
        <ArcScope>
          <SegmentedControl
            label={t("选择日期", "Choose a day")}
            options={dayOptions}
            value={navDays.includes(selectedDate) ? selectedDate : today}
            onValueChange={setSelectedDate}
          />
        </ArcScope>

        <section className="life-stage grid items-start gap-x-6 gap-y-4 xl:grid-cols-[14rem_minmax(22rem,32rem)_minmax(16rem,1fr)]" aria-label={t("热量概览", "Calorie overview")}>
          <section className="min-w-0" aria-label={t("当日热量", "Calories for this day")}>
            <p className="text-sm text-muted-foreground">{format(parseISO(selectedDate), lang === "zh" ? "M月d日 EEE" : "EEEE, MMM d", { locale })}</p>
            <ArcScope className="mt-1 inline-flex">
              <AnimatedCounter value={totalCalories} suffix=" kcal" locale={lang === "zh" ? "zh-CN" : "en-US"} />
            </ArcScope>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("摄入", "Intake")} {foodCalories} · {t("运动", "Exercise")} {exerciseCalories}
            </p>
            <p className={`mt-1 text-sm font-medium ${remaining < 0 ? "text-cat-orange" : "text-cat-green"}`}>
              {remaining < 0
                ? t(`超出目标 ${Math.abs(remaining)} kcal`, `${Math.abs(remaining)} kcal over target`)
                : t(`距目标还剩 ${remaining} kcal`, `${remaining} kcal left of ${target}`)}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full origin-left rounded-full bg-foreground transition-transform duration-500 ease-out"
                style={{ transform: `scaleX(${Math.max(0, Math.min(1, totalCalories / target))})` }}
              />
            </div>
          </section>
          <MealDistributionChart records={records} activeKey={pinnedMeal} onActiveChange={setActiveMeal} />

          <section className="min-w-0" aria-label={t("本周热量", "Weekly calories")}>
            <h2 className="mb-3 text-sm font-medium">{t("本周", "This week")}</h2>
            <WeeklyCalorieChart days={navDays} records={weeklyRecords} target={target} onDayChange={setSelectedDate} />
          </section>
        </section>

        <div className="space-y-2">
        {MEAL_TYPES.map(({ key }) => {
          const mealRecords = records.filter((record) => record.meal_type === key);
          const mealTotal = mealRecords.reduce((sum: number, record) => sum + record.calories, 0);
          const MealIcon = MEAL_TYPE_ICONS[key];
          const active = pinnedMeal === key;
          return (
            <section
              key={key}
              id={`meal-${key}`}
              className="meal-band px-1"
              data-active={active || undefined}
              data-quiet={pinnedMeal !== null && !active ? "true" : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="flex h-8 items-center gap-1.5 text-sm font-medium" onClick={() => setActiveMeal(active ? null : key)}>
                  {MealIcon && <MealIcon className="h-4 w-4 text-muted-foreground" />}
                  {mealLabels[key]}
                  <span className="ml-1 font-normal text-muted-foreground">{mealTotal} kcal</span>
                </button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => openSheet(key)}>
                  <Plus className="mr-1 h-3 w-3" />{t("添加", "Add")}
                </Button>
              </div>
              {mealRecords.length === 0 ? (
                <p className="pl-1 text-xs text-muted-foreground">{t("暂无记录", "No records")}</p>
              ) : (
                <div className="space-y-1">
                  {mealRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="truncate text-sm">{record.food_name}</span>
                        <span className="shrink-0 text-xs font-medium text-cat-orange">{record.calories} kcal</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label={t("编辑食物记录", "Edit food record")} className="h-8 w-8" onClick={() => openSheet(record.meal_type, record)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <ArcScope className="inline-flex">
                          <ConfirmMorph
  className="confirm-quiet"
                            tone="danger"
                            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                            label={<span className="sr-only">{t("删除食物记录", "Delete food record")}</span>}
                            prompt={t("删除这条记录？", "Delete this record?")}
                            confirmLabel={t("删除", "Delete")}
                            cancelLabel={t("取消", "Cancel")}
                            doneLabel={t("已删除", "Deleted")}
                            onConfirm={() => deleteMutation.mutateAsync(record.id)}
                          />
                        </ArcScope>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        </div>

        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={`${editingItem ? t("编辑", "Edit") : t("添加", "Add")} ${t("记录", "Record")}`}
          description={t("写下吃了什么，热量会立刻进到当天的环图里。", "Name the food. Its calories join this day's ring.")}
          detents={[0.62, 0.92]}
          initialDetent={1}
          className="arc-runtime"
          closeLabel={t("关闭", "Close")}
        >
          {calorieForm}
        </BottomSheet>
      </div>
    </AppLayout>
  );
}
