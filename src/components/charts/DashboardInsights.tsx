import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingDown, TrendingUp, Flame, Target, Wallet, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";

interface InsightCardProps {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  trend?: string;
  trendColor?: string;
}

function InsightCard({ icon, iconBg, value, label, trend, trendColor }: InsightCardProps) {
  return (
    <div className="card-premium p-4 min-w-[180px] snap-start">
      <div className="flex items-start justify-between mb-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-[11px] font-medium ${trendColor || "text-[#8a847a]"}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-[20px] font-semibold text-[#1f1a14] font-mono-data leading-tight">{value}</p>
      <p className="text-[11px] text-[#8a847a] mt-0.5">{label}</p>
    </div>
  );
}

interface DashboardInsightsProps {
  monthlySpending: number;
  monthlyBudget: number;
  lastMonthSpending?: number;
  streakDays?: number;
  weekCalorieDaysOnTarget?: number;
  weekCalorieDaysTotal?: number;
  completedGoals?: number;
  totalGoals?: number;
  studyHours?: number;
}

export function DashboardInsights({
  monthlySpending,
  monthlyBudget,
  lastMonthSpending,
  streakDays,
  weekCalorieDaysOnTarget,
  weekCalorieDaysTotal,
  completedGoals,
  totalGoals,
  studyHours,
}: DashboardInsightsProps) {
  const { t, lang } = useLang();

  const remaining = monthlyBudget - monthlySpending;
  const spendChange = lastMonthSpending && lastMonthSpending > 0
    ? ((monthlySpending - lastMonthSpending) / lastMonthSpending * 100)
    : null;

  const insights: InsightCardProps[] = [];

  // Spending insight
  insights.push({
    icon: <Wallet className="h-4 w-4 text-[#d17847]" />,
    iconBg: "bg-[#fce0c8]",
    value: `¥${monthlySpending.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    label: t("本月支出", "Monthly Spending"),
    trend: spendChange !== null ? `${spendChange > 0 ? "+" : ""}${spendChange.toFixed(0)}% ${t("vs 上月", "vs last month")}` : undefined,
    trendColor: spendChange !== null && spendChange <= 0 ? "text-[#5b8c44]" : "text-[#d17847]",
  });

  // Budget remaining
  insights.push({
    icon: <Target className="h-4 w-4 text-[#5b8c44]" />,
    iconBg: "bg-[#dcead4]",
    value: `¥${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    label: t("本月剩余预算", "Budget Remaining"),
    trend: `${((remaining / monthlyBudget) * 100).toFixed(0)}%`,
    trendColor: remaining > 0 ? "text-[#5b8c44]" : "text-[#d17847]",
  });

  // Streak
  if (streakDays !== undefined && streakDays > 0) {
    insights.push({
      icon: <Flame className="h-4 w-4 text-[#d17847]" />,
      iconBg: "bg-[#fce0c8]",
      value: `${streakDays}`,
      label: t("连续打卡", "Day Streak"),
      trend: streakDays >= 7 ? "🔥" : undefined,
    });
  }

  // Calorie target
  if (weekCalorieDaysOnTarget !== undefined && weekCalorieDaysTotal !== undefined) {
    insights.push({
      icon: <CheckCircle2 className="h-4 w-4 text-[#5b88b5]" />,
      iconBg: "bg-[#e1eaf4]",
      value: `${weekCalorieDaysOnTarget}/${weekCalorieDaysTotal}`,
      label: t("本周热量达标", "Calorie Target Hit"),
      trend: weekCalorieDaysOnTarget >= 5 ? "✓" : undefined,
      trendColor: "text-[#5b8c44]",
    });
  }

  // Goals
  if (completedGoals !== undefined && totalGoals !== undefined) {
    insights.push({
      icon: <Target className="h-4 w-4 text-[#8b7bb8]" />,
      iconBg: "bg-[#e7ddf1]",
      value: `${completedGoals}/${totalGoals}`,
      label: t("月目标完成", "Monthly Goals"),
    });
  }

  // Study hours
  if (studyHours !== undefined) {
    insights.push({
      icon: <Clock className="h-4 w-4 text-[#5a9da8]" />,
      iconBg: "bg-[#cfe4df]",
      value: `${studyHours.toFixed(1)}h`,
      label: t("本周学习时间", "Weekly Study Hours"),
    });
  }

  return (
    <div>
      <p className="text-sm font-medium text-[#8a847a] mb-3">{t("数据概览", "Key Insights")}</p>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {insights.map((insight, i) => (
          <InsightCard key={i} {...insight} />
        ))}
      </div>
    </div>
  );
}
