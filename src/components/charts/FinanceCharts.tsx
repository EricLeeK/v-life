import { useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  PieChart, Pie, Cell,
  BarChart, Bar,
  ResponsiveContainer, Legend,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { chartPalette, piePalette } from "@/lib/chartTokens";
import { format, getDaysInMonth } from "date-fns";

const COLORS = {
  get orange() { return chartPalette.orange(); },
  get teal() { return chartPalette.teal(); },
  get purple() { return chartPalette.purple(); },
  get green() { return chartPalette.green(); },
  get yellow() { return chartPalette.yellow(); },
  get blue() { return chartPalette.blue(); },
};

const PIE_COLORS = () => piePalette();

interface FinanceRecord {
  date: string;
  amount_cny: number;
  category: string;
}

export function SpendingTrendChart({ records, budget, year, month }: {
  records: FinanceRecord[];
  budget: number;
  year: number;
  month: number;
}) {
  const { t, lang } = useLang();
  const data = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const dailyMap: Record<string, number> = {};
    records.forEach((r) => {
      dailyMap[r.date] = (dailyMap[r.date] || 0) + Number(r.amount_cny);
    });
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return { date: String(i + 1), amount: Number((dailyMap[d] || 0).toFixed(2)) };
    });
  }, [records, year, month]);

  const dailyBudget = budget / getDaysInMonth(new Date(year, month - 1));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("支出趋势", "Spending Trend")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.orange} stopOpacity={0.3} />
                <stop offset="100%" stopColor={COLORS.orange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `¥${v}`} />
            <Tooltip content={<ChartTooltip formatter={(v) => `¥${v.toFixed(2)}`} />} />
            <Area type="monotone" dataKey="amount" fill="url(#spendGrad)" stroke="none" />
            <Line type="monotone" dataKey="amount" stroke={COLORS.orange} strokeWidth={2} dot={false} />
            <ReferenceLine y={dailyBudget} stroke={COLORS.teal} strokeDasharray="5 5" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function CategoryPieChart({ categoryData }: {
  categoryData: Array<{ name: string; value: number }>;
}) {
  const { t, lang } = useLang();
  const total = categoryData.reduce((s, c) => s + c.value, 0);

  const CATEGORY_EN: Record<string, string> = {
    "餐饮": "Food", "日用": "Daily", "交通": "Transport", "住房": "Housing",
    "通讯/订阅": "Subscriptions", "医疗": "Medical", "服饰": "Clothing",
    "娱乐": "Entertainment", "学习": "Education", "电子": "Electronics",
    "大额": "Major", "税费": "Tax", "其他": "Other",
  };

  const top5 = categoryData.slice(0, 5);
  const rest = categoryData.slice(5);
  const chartData = rest.length > 0
    ? [...top5, { name: t("其他", "Other"), value: rest.reduce((s, c) => s + c.value, 0) }]
    : top5;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("分类占比", "Category Breakdown")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none" paddingAngle={2}>
                {chartData.map((_, i) => {
                  const colors = PIE_COLORS();
                  return <Cell key={i} fill={colors[i % colors.length]} />;
                })}
              </Pie>
              <Tooltip content={<ChartTooltip formatter={(v) => `¥${v.toFixed(2)}`} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {chartData.map((item, i) => {
              const colors = PIE_COLORS();
              return (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                  <span className="truncate">{lang === "zh" ? item.name : (CATEGORY_EN[item.name] || item.name)}</span>
                </span>
                <span className="text-muted-foreground font-mono-data shrink-0 ml-2">
                  ¥{item.value.toFixed(0)} <span className="text-[10px]">({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
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

export function BudgetUsageChart({ budget, totalSpent }: {
  budget: number;
  totalSpent: number;
}) {
  const { t } = useLang();
  const remaining = Math.max(0, budget - totalSpent);
  const pct = budget > 0 ? Math.min(100, (totalSpent / budget) * 100) : 0;
  const data = [{ name: t("预算", "Budget"), budget, spent: Math.min(totalSpent, budget) }];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("预算使用", "Budget Usage")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-foreground font-mono-data">¥{totalSpent.toFixed(0)}</span>
            <span className="text-xs text-muted-foreground">/ ¥{budget.toLocaleString()}</span>
          </div>
          <div className="h-4 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct > 90 ? "hsl(var(--destructive))" : COLORS.orange }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{pct.toFixed(0)}% {t("已使用", "used")}</span>
            <span className="text-cat-green font-medium font-mono-data">¥{remaining.toFixed(0)} {t("剩余", "left")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
