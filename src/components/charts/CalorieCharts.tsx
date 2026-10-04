import { useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useLang } from "@/contexts/LanguageContext";
import { ShareDonut, TrendLine } from "@/components/arc/ShareCharts";
import type { LineChartDatum } from "@/vendor/uiarc/registry/components/line-chart/line-chart";

const MEAL_COLOR: Record<string, string> = {
  breakfast: "hsl(var(--cat-yellow))",
  lunch: "hsl(var(--cat-orange))",
  dinner: "hsl(var(--cat-purple))",
  snack: "hsl(var(--cat-teal))",
  exercise: "hsl(var(--cat-green))",
};

interface CalorieRecord {
  date: string;
  calories: number;
  meal_type: string;
}

export function WeeklyCalorieChart({
  days,
  records,
  target,
  onDayChange,
}: {
  days: string[];
  records: CalorieRecord[];
  target: number;
  onDayChange?: (date: string) => void;
}) {
  const { t, lang } = useLang();
  const locale = lang === "zh" ? zhCN : undefined;
  const hovered = useRef<string | null>(null);
  const pressed = useRef(false);

  const data = useMemo<LineChartDatum[]>(() => days.map((date) => {
    const dayRecords = records.filter((record) => record.date === date);
    const food = dayRecords.filter((record) => record.meal_type !== "exercise").reduce((sum, record) => sum + record.calories, 0);
    const exercise = dayRecords.filter((record) => record.meal_type === "exercise").reduce((sum, record) => sum + record.calories, 0);
    const parsed = parseISO(date);
    return {
      key: date,
      label: format(parsed, lang === "zh" ? "M月d日 EEE" : "EEE, MMM d", { locale }),
      axisLabel: format(parsed, "M/d"),
      values: { food, exercise, target },
    };
  }), [days, records, target, lang, locale]);

  return (
    <div
      onPointerDown={(event) => { pressed.current = event.pointerType === "mouse" ? event.button === 0 : true; }}
      onPointerUp={(event) => {
        const fromControl = event.target instanceof Element && event.target.closest("button");
        if (pressed.current && !fromControl && hovered.current) onDayChange?.(hovered.current);
        pressed.current = false;
      }}
      onPointerCancel={() => { pressed.current = false; }}
    >
    <TrendLine
      data={data}
      series={[
        { key: "food", label: t("摄入", "Intake"), color: "hsl(var(--cat-orange))", area: true },
        { key: "exercise", label: t("运动", "Exercise"), color: "hsl(var(--cat-green))", area: false },
        { key: "target", label: t("目标", "Target"), color: "hsl(var(--cat-teal))", dashed: true, area: false },
      ]}
      label={t("本周热量", "Weekly calories")}
      unit="kcal"
      height={220}
      formatValue={(value) => `${Math.round(value)}`}
      formatTick={(value) => `${Math.round(value)}`}
      emptyLabel={t("暂无数据", "No data")}
      categoryLabel={t("日期", "Date")}
      onActiveChange={(_index, datum) => { hovered.current = datum?.key ?? null; }}
    />
    </div>
  );
}

export function MealDistributionChart({
  records,
  activeKey,
  onActiveChange,
}: {
  records: CalorieRecord[];
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
}) {
  const { t, lang } = useLang();

  const data = useMemo(() => {
    const labels: Record<string, string> = {
      breakfast: t("早餐", "Breakfast"),
      lunch: t("午餐", "Lunch"),
      dinner: t("晚餐", "Dinner"),
      snack: t("加餐", "Snack"),
      exercise: t("运动", "Exercise"),
    };
    const totals = new Map<string, number>();
    records.forEach((record) => totals.set(record.meal_type, (totals.get(record.meal_type) ?? 0) + record.calories));
    return [...totals.entries()]
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        key,
        label: labels[key] || key,
        value,
        color: MEAL_COLOR[key] || "hsl(var(--cat-blue))",
      }))
      .sort((a, b) => b.value - a.value);
  }, [records, t, lang]);

  return (
    <ShareDonut
      data={data}
      label={t("餐次分布", "Meal breakdown")}
      unit="kcal"
      formatValue={(value) => `${Math.round(value)}`}
      totalLabel={t("合计", "Total")}
      otherLabel={t("其他", "Other")}
      emptyLabel={t("暂无数据", "No data")}
      activeKey={activeKey}
      onActiveChange={onActiveChange}
      size={208}
      thickness={24}
    />
  );
}
