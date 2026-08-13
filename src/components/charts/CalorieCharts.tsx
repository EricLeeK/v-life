import { useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { chartPalette } from "@/lib/chartTokens";
import { format, subDays } from "date-fns";

const COLORS = {
  get orange() { return chartPalette.orange(); },
  get green() { return chartPalette.green(); },
  get teal() { return chartPalette.teal(); },
  get purple() { return chartPalette.purple(); },
  get yellow() { return chartPalette.yellow(); },
  get blue() { return chartPalette.blue(); },
};

const MEAL_COLORS = (): Record<string, string> => ({
  breakfast: COLORS.yellow,
  lunch: COLORS.orange,
  dinner: COLORS.purple,
  snack: COLORS.teal,
  exercise: COLORS.green,
});

interface CalorieRecord {
  date: string;
  calories: number;
  meal_type: string;
}

export function WeeklyCalorieChart({ records, target }: {
  records: CalorieRecord[];
  target: number;
}) {
  const { t, lang } = useLang();

  const data = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayRecords = records.filter((r) => r.date === dateStr);
      const food = dayRecords
        .filter((r) => r.meal_type !== "exercise")
        .reduce((s, r) => s + r.calories, 0);
      const exercise = dayRecords
        .filter((r) => r.meal_type === "exercise")
        .reduce((s, r) => s + r.calories, 0);
      return {
        date: format(d, lang === "zh" ? "M/d" : "EEE"),
        food,
        exercise: -exercise,
        net: food - exercise,
      };
    });
  }, [records, lang]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("本周热量", "Weekly Calories")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={target} stroke={COLORS.teal} strokeDasharray="5 5" strokeWidth={1} />
            <Bar dataKey="food" stackId="cal" fill={COLORS.orange} radius={[4, 4, 0, 0]} name={t("摄入", "Intake")} />
            <Bar dataKey="exercise" stackId="cal" fill={COLORS.green} radius={[0, 0, 4, 4]} name={t("运动", "Exercise")} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MealDistributionChart({ records }: { records: CalorieRecord[] }) {
  const { t } = useLang();

  const MEAL_LABELS: Record<string, string> = {
    breakfast: t("早餐", "Breakfast"),
    lunch: t("午餐", "Lunch"),
    dinner: t("晚餐", "Dinner"),
    snack: t("加餐", "Snack"),
    exercise: t("运动", "Exercise"),
  };

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      map[r.meal_type] = (map[r.meal_type] || 0) + r.calories;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: MEAL_LABELS[name] || name, value, key: name }))
      .sort((a, b) => b.value - a.value);
  }, [records, MEAL_LABELS]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("餐次分布", "Meal Breakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-6">{t("暂无数据", "No data")}</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("餐次分布", "Meal Breakdown")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none" paddingAngle={2}>
                {data.map((entry) => {
                  const meal = MEAL_COLORS();
                  return <Cell key={entry.key} fill={meal[entry.key] || COLORS.blue} />;
                })}
              </Pie>
              <Tooltip content={<ChartTooltip formatter={(v) => `${v} kcal`} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {data.map((item) => {
              const meal = MEAL_COLORS();
              return (
              <div key={item.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meal[item.key] || COLORS.blue }} />
                  <span>{item.name}</span>
                </span>
                <span className="text-muted-foreground font-mono-data">
                  {item.value} kcal <span className="text-[10px]">({((item.value / total) * 100).toFixed(0)}%)</span>
                </span>
              </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
