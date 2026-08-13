import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, Flame, Wallet, CheckSquare, Carrot, Package,
  Lightbulb, Target, TrendingDown, Timer, Kanban, Sparkles,
  ChevronRight, ArrowRight, ChevronDown, CheckCircle2, Clock, GraduationCap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import {
  useTodaySchedule, useTodayCalorieSummary, useTodayCalorieBreakdown, useMonthFinanceSummary, useFinanceByMonth,
  usePendingTodos, useExpiringPantry, useOverdueDurables, useRecentThoughts, useSettings,
  useCurrentWeekGoals, useRecentWeightTrend, useProjects, todoHooks, calorieHooks, scheduleHooks,
} from "@/hooks/useData";
import { usePrimaryExam, useTodayCivilPlans } from "@/hooks/useCivilService";
import { differenceInCalendarDays, parseISO, format, subDays, startOfWeek } from "date-fns";
import { LineChart, Line, ResponsiveContainer } from "recharts";


const WEEKDAYS_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getGreeting(hour: number): string {
  if (hour < 6) return "凌晨好";
  if (hour < 12) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getGreetingEn(hour: number): string {
  if (hour < 6) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 14) return "Good afternoon";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Category accents — wired to --cat-* design tokens
const CAT = {
  green:  { text: "text-cat-green", bg: "bg-cat-green-bg", border: "border-cat-green-bg" },
  blue:   { text: "text-cat-blue", bg: "bg-cat-blue-bg", border: "border-cat-blue-bg" },
  orange: { text: "text-cat-orange", bg: "bg-cat-orange-bg", border: "border-cat-orange-bg" },
  teal:   { text: "text-cat-teal", bg: "bg-cat-teal-bg", border: "border-cat-teal-bg" },
  purple: { text: "text-cat-purple", bg: "bg-cat-purple-bg", border: "border-cat-purple-bg" },
  yellow: { text: "text-cat-yellow", bg: "bg-cat-yellow-bg", border: "border-cat-yellow-bg" },
};

function MetricCard({ label, value, hint, color }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  color?: keyof typeof CAT;
}) {
  const c = color ? CAT[color] : null;
  return (
    <div className="card-premium p-4 min-w-0">
      <p className="text-[12px] text-muted-foreground font-medium tracking-wide uppercase">{label}</p>
      <p className="text-[28px] font-semibold text-foreground leading-tight mt-1 font-mono-data tracking-tight">
        {value}
      </p>
      {hint && (
        <p className={`text-[11px] mt-1 ${c ? c.text : "text-muted-foreground"}`}>{hint}</p>
      )}
    </div>
  );
}

function PipelineRow({ icon, iconColor, title, subtitle, pill, pillColor, onClick }: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle?: string;
  pill?: string;
  pillColor?: keyof typeof CAT;
  onClick?: () => void;
}) {
  const pc = pillColor ? CAT[pillColor] : null;
  return (
    <button
      type="button"
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded-lg transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className={`h-8 w-8 rounded-lg ${iconColor} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {pill && pc && (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pc.bg} ${pc.text} shrink-0`}>
          {pill}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-border group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

function FeatureCard({ icon, title, description, status, statusColor, onClick }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: string;
  statusColor?: keyof typeof CAT;
  onClick?: () => void;
}) {
  const sc = statusColor ? CAT[statusColor] : null;
  return (
    <button
      type="button"
      className="w-full text-left card-premium p-4 cursor-pointer group focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          {icon}
        </div>
        {status && sc && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
            {status}
          </span>
        )}
      </div>
      <p className="text-[13px] font-semibold text-foreground mt-2">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const now = new Date();
  const { data: settings } = useSettings();
  const { data: todayEvents = [] } = useTodaySchedule();
  const { data: todayCalories = 0 } = useTodayCalorieSummary();
  const { data: calorieBreakdown = {} } = useTodayCalorieBreakdown();
  const { data: financeSummary } = useMonthFinanceSummary(now.getFullYear(), now.getMonth() + 1);
  const { data: monthFinanceRecords = [] } = useFinanceByMonth(now.getFullYear(), now.getMonth() + 1);
  const { data: pendingTodos = [] } = usePendingTodos();
  const { data: allTodos = [] } = todoHooks.useList();
  const { data: expiringPantry = [] } = useExpiringPantry();
  const { data: overdueDurables = [] } = useOverdueDurables();
  const { data: recentThoughts = [] } = useRecentThoughts();
  const { data: weekGoals = [] } = useCurrentWeekGoals();
  const { data: weightTrend = [] } = useRecentWeightTrend();
  const { data: primaryExam } = usePrimaryExam();
  const { data: todayCivilPlans = [] } = useTodayCivilPlans();
  const { data: allProjects = [] } = useProjects();
  const { data: allCalorieRecords = [] } = calorieHooks.useList();
  const { data: weekScheduleEvents = [] } = scheduleHooks.useList();
  const activeProjects = allProjects.filter((p: any) => p.status === "active" || p.status === "planning");
  const avgProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((s: number, p: any) => s + p.progress, 0) / activeProjects.length)
    : 0;

  const calorieTarget = settings?.calorie_target || 2000;
  const budget = settings?.monthly_budget || 5000;
  const totalSpending = financeSummary?.total || 0;
  const urgentTodos = pendingTodos.filter((t: any) => t.importance === "紧急" || t.importance === "urgent");

  // Insights computation
  const weekCalorieRecords = (allCalorieRecords as any[]).filter((r: any) => {
    const d = r.date;
    const weekAgo = subDays(now, 6).toISOString().split("T")[0];
    return d >= weekAgo;
  });
  const calorieDaysMap: Record<string, { food: number; exercise: number }> = {};
  weekCalorieRecords.forEach((r: any) => {
    if (!calorieDaysMap[r.date]) calorieDaysMap[r.date] = { food: 0, exercise: 0 };
    if (r.meal_type === "exercise") calorieDaysMap[r.date].exercise += r.calories;
    else calorieDaysMap[r.date].food += r.calories;
  });
  const weekCalorieDaysTotal = Object.keys(calorieDaysMap).length;
  const weekCalorieDaysOnTarget = Object.values(calorieDaysMap).filter(
    (d) => (d.food - d.exercise) <= calorieTarget
  ).length;

  // Study hours from schedule events this week
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const studyHours = (weekScheduleEvents as any[])
    .filter((e: any) => {
      const start = new Date(e.start_time);
      return start >= weekStart && (e.color === "blue" || e.color === "teal");
    })
    .reduce((sum: number, e: any) => {
      const duration = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

  const completedMonthlyGoals = (weekGoals as any[]).filter((g: any) => g.is_completed).length;

  // KPI strip derived values
  const todayStr = format(now, "yyyy-MM-dd");
  const todayFinanceTotal = (monthFinanceRecords as any[])
    .filter((r) => r.date === todayStr)
    .reduce((sum, r) => sum + Number(r.amount_cny), 0);
  const completedTodos = (allTodos as any[]).filter((t) => t.is_completed && !t.is_archived).length;
  const totalTodos = (allTodos as any[]).filter((t) => !t.is_archived).length;
  const overdueTodoCount = (allTodos as any[]).filter(
    (t) => !t.is_completed && !t.is_archived && t.due_date && new Date(t.due_date) < now
  ).length;
  const completedGoals = (weekGoals as any[]).filter((g) => g.is_completed).length;
  const goalProgressPct = weekGoals.length > 0
    ? Math.round((completedGoals / weekGoals.length) * 100)
    : 0;
  const remainingCalories = calorieTarget - todayCalories;

  const displayName = settings?.display_name?.trim();
  const greeting = displayName
    ? (lang === "zh"
        ? `${displayName}，${getGreeting(now.getHours())}`
        : `${getGreetingEn(now.getHours())}, ${displayName}`)
    : (lang === "zh" ? getGreeting(now.getHours()) : getGreetingEn(now.getHours()));
  const weekdays = lang === "zh" ? WEEKDAYS_ZH : WEEKDAYS_EN;
  const dateLabel = lang === "zh"
    ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
    : `${weekdays[now.getDay()]}, ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  // Fasting calculation
  const fastingStartHour = settings?.fasting_start_hour ?? 12;
  const fastingStartMinute = (settings as any)?.fasting_start_minute ?? 0;
  const eatingStartMin = fastingStartHour * 60 + fastingStartMinute;
  const eatingEndMin = (eatingStartMin + 8 * 60) % (24 * 60);
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();
  const isEatingWindow = eatingEndMin > eatingStartMin
    ? currentTotalMin >= eatingStartMin && currentTotalMin < eatingEndMin
    : currentTotalMin >= eatingStartMin || currentTotalMin < eatingEndMin;

  const nextEvent = todayEvents.length > 0
    ? todayEvents.find((e: any) => new Date(e.start_time) > now) || todayEvents[0]
    : null;

  // Weight trend data
  const latestWeight = weightTrend.length > 0 ? Number(weightTrend[weightTrend.length - 1]?.weight) : null;
  const weightDiff = weightTrend.length >= 2
    ? Number(weightTrend[weightTrend.length - 1]?.weight) - Number(weightTrend[0]?.weight)
    : null;

  const civilDaysLeft = primaryExam
    ? differenceInCalendarDays(parseISO(primaryExam.exam_date), now)
    : null;
  const civilPlanDone = todayCivilPlans.filter((p) => p.is_completed).length;

  // Expiring pantry count
  const expiringSoonCount = expiringPantry.filter((item: any) => {
    if (!item.expiry_date) return false;
    const days = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000);
    return days <= 3;
  }).length;

  const hiddenFeatures = settings?.hidden_features || [];
  const focusMode = (settings as any)?.app_focus_mode || "full";

  const isVisible = (id: string) => {
    if (focusMode === "civil_service") {
      return id === "civil-service";
    }
    return !hiddenFeatures.includes(id);
  };

  const GRID_COLS: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  };

  // Filtered Metric Cards
  const metricCards = [
    isVisible("schedule") && {
      key: "schedule",
      label: t("今日日程", "Today's Schedule"),
      value: todayEvents.length,
      hint: nextEvent && (nextEvent as any).start_time ? `${format(new Date((nextEvent as any).start_time), "HH:mm")}` : t("暂无安排", "No events"),
      color: "blue" as const,
    },
    isVisible("finance") && {
      key: "finance",
      label: t("今日支出", "Today's Spending"),
      value: `¥${todayFinanceTotal.toFixed(0)}`,
      hint: lang === "zh" ? `本月 ¥${totalSpending.toFixed(0)}` : `This month ¥${totalSpending.toFixed(0)}`,
      color: "orange" as const,
    },
    isVisible("calories") && {
      key: "calories",
      label: t("剩余热量", "Remaining"),
      value: remainingCalories,
      hint: `${todayCalories} / ${calorieTarget} kcal`,
      color: (remainingCalories < 0 ? "orange" : "green") as const,
    },
    isVisible("todos") && {
      key: "todos",
      label: t("待办进度", "To-Do Progress"),
      value: `${completedTodos}/${totalTodos}`,
      hint: overdueTodoCount > 0 ? `${overdueTodoCount} ${t("项逾期", "overdue")}` : t("无逾期", "No overdue"),
      color: (overdueTodoCount > 0 ? "orange" : "green") as const,
    },
    isVisible("goals") && {
      key: "goals",
      label: t("本周目标", "Weekly Goals"),
      value: `${goalProgressPct}%`,
      hint: `${completedGoals}/${weekGoals.length} ${t("已完成", "done")}`,
      color: (goalProgressPct >= 50 ? "green" : "blue") as const,
    },
    isVisible("projects") && {
      key: "projects",
      label: t("活跃项目", "Active Projects"),
      value: activeProjects.length,
      hint: `${t("平均进度", "Avg progress")} ${avgProgress}%`,
      color: "purple" as const,
    },
    isVisible("civil-service") && primaryExam && {
      key: "civil-service",
      label: t("考公倒计时", "Exam Countdown"),
      value: civilDaysLeft !== null ? `${Math.max(civilDaysLeft, 0)}天` : "--",
      hint: primaryExam.name,
      color: "orange" as const,
    },
    isVisible("weight-loss") && latestWeight !== null && {
      key: "weight-loss",
      label: t("最新体重", "Weight"),
      value: `${latestWeight.toFixed(1)}kg`,
      hint: weightDiff !== null ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}kg` : undefined,
      color: "teal" as const,
    },
  ].filter(Boolean) as Array<{ key: string; label: string; value: React.ReactNode; hint?: string; color?: keyof typeof CAT }>;

  // Filtered Life Module Cards
  const lifeModuleCards = [
    isVisible("schedule") && {
      id: "schedule",
      icon: <CalendarDays className="h-4 w-4 text-[#5b88b5]" />,
      title: t("日程计划", "Schedule"),
      description: `${todayEvents.length} ${lang === "zh" ? "个今日日程" : "events today"}`,
      status: todayEvents.length > 0 ? `${todayEvents.length}` : undefined,
      statusColor: "blue" as const,
      onClick: () => navigate("/schedule"),
    },
    isVisible("finance") && {
      id: "finance",
      icon: <Wallet className="h-4 w-4 text-[#d17847]" />,
      title: t("记账", "Finance"),
      description: lang === "zh" ? `本月 ¥${totalSpending.toFixed(0)}` : `This month ¥${totalSpending.toFixed(0)}`,
      status: totalSpending > budget ? t("超支", "Over") : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/finance"),
    },
    isVisible("calories") && {
      id: "calories",
      icon: <Flame className="h-4 w-4 text-[#d17847]" />,
      title: t("热量记录", "Calories"),
      description: `${todayCalories} / ${calorieTarget} kcal`,
      status: remainingCalories < 0 ? t("超额", "Over") : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/calories"),
    },
    isVisible("todos") && {
      id: "todos",
      icon: <CheckSquare className="h-4 w-4 text-[#5b8c44]" />,
      title: t("待办事项", "To-Dos"),
      description: `${pendingTodos.length} ${lang === "zh" ? "个待完成" : "pending"}`,
      status: urgentTodos.length > 0 ? `${urgentTodos.length} ${t("紧急", "urgent")}` : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/todos"),
    },
    isVisible("pantry") && {
      id: "pantry",
      icon: <Carrot className="h-4 w-4 text-[#c49840]" />,
      title: t("食材管理", "Pantry"),
      description: expiringSoonCount > 0 ? `${expiringSoonCount} ${t("个即将过期", "expiring soon")}` : t("库存充足", "Well stocked"),
      status: expiringSoonCount > 0 ? `${expiringSoonCount}` : undefined,
      statusColor: "yellow" as const,
      onClick: () => navigate("/pantry"),
    },
    isVisible("belongings") && {
      id: "belongings",
      icon: <Package className="h-4 w-4 text-[#c49840]" />,
      title: t("用品管理", "Belongings"),
      description: overdueDurables.length > 0 ? `${overdueDurables.length} ${t("个超值用品", "expiring soon")}` : t("暂无记录", "No records"),
      onClick: () => navigate("/belongings"),
    },
    isVisible("goals") && {
      id: "goals",
      icon: <Target className="h-4 w-4 text-[#5b8c44]" />,
      title: t("目标", "Goals"),
      description: `${completedGoals}/${weekGoals.length} ${t("本周已完成", "done this week")}`,
      status: goalProgressPct > 0 ? `${goalProgressPct}%` : undefined,
      statusColor: "green" as const,
      onClick: () => navigate("/goals"),
    },
    isVisible("projects") && {
      id: "projects",
      icon: <Kanban className="h-4 w-4 text-[#5b88b5]" />,
      title: t("项目管理", "Projects"),
      description: `${activeProjects.length} ${t("个活跃项目", "active projects")}`,
      status: avgProgress > 0 ? `${avgProgress}%` : undefined,
      statusColor: "blue" as const,
      onClick: () => navigate("/projects"),
    },
    isVisible("weight-loss") && {
      id: "weight-loss",
      icon: <TrendingDown className="h-4 w-4 text-[#5a9da8]" />,
      title: t("减肥专项", "Weight Loss"),
      description: latestWeight ? `${latestWeight.toFixed(1)} kg` : t("暂无记录", "No records"),
      status: weightDiff !== null ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}` : undefined,
      statusColor: (weightDiff !== null && weightDiff <= 0 ? "teal" : "orange") as const,
      onClick: () => navigate("/weight-loss"),
    },
    isVisible("civil-service") && {
      id: "civil-service",
      icon: <GraduationCap className="h-4 w-4 text-[#d17847]" />,
      title: t("考公", "Civil Service"),
      description: primaryExam ? `${primaryExam.name} · ${t("今日计划", "Today")} ${civilPlanDone}/${todayCivilPlans.length}` : t("添加考试倒计时", "Add exam countdown"),
      status: civilDaysLeft !== null ? `${Math.max(civilDaysLeft, 0)}${t("天", "d")}` : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/civil-service"),
    },
    isVisible("thoughts") && {
      id: "thoughts",
      icon: <Lightbulb className="h-4 w-4 text-[#8b7bb8]" />,
      title: t("随想", "Thoughts"),
      description: recentThoughts.length > 0 ? `${recentThoughts.length} ${t("条最近记录", "recent records")}` : t("暂无随想", "No thoughts"),
      onClick: () => navigate("/thoughts"),
    },
    isVisible("learning-notes") && {
      id: "learning-notes",
      icon: <BookOpen className="h-4 w-4 text-[#5b88b5]" />,
      title: t("学习笔记", "Learning Notes"),
      description: t("查看与优化学习笔记", "View & optimize notes"),
      onClick: () => navigate("/learning-notes"),
    },
    isVisible("fortune") && {
      id: "fortune",
      icon: <Sparkles className="h-4 w-4 text-[#8b7bb8]" />,
      title: t("运势分析", "Fortune"),
      description: t("今日运势与灵感", "Today's fortune"),
      onClick: () => navigate("/fortune"),
    },
  ].filter(Boolean) as Array<{
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    status?: string;
    statusColor?: keyof typeof CAT;
    onClick: () => void;
  }>;

  const showScheduleOverview = isVisible("schedule");
  const showTodosOverview = isVisible("todos");
  const showTodayOverviewSection = showScheduleOverview || showTodosOverview;

  return (
    <AppLayout title={t("首页概览", "Dashboard")}>
      <div className="space-y-10">

        {/* ── Hero Section ── */}
        <section>
          <h1
            className="font-bold text-foreground leading-[1.1] tracking-tight heading-font"
            style={{ fontSize: "clamp(34px, 4.8vw, 64px)" }}
          >
            {greeting}
          </h1>
          <p className="text-[14px] text-muted-foreground mt-2">{dateLabel}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { id: "schedule", label: t("日程", "Schedule") },
              { id: "finance", label: t("记账", "Finance") },
              { id: "calories", label: t("热量", "Calories") },
              { id: "todos", label: t("待办", "To-Do") },
              { id: "goals", label: t("目标", "Goals") },
              { id: "projects", label: t("项目", "Projects") },
              { id: "civil-service", label: t("考公", "Civil Service") },
              { id: "learning-notes", label: t("学习", "Learning") },
            ]
              .filter((item) => isVisible(item.id))
              .map((tag) => (
                <span
                  key={tag.id}
                  className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white border border-border text-muted-foreground"
                >
                  {tag.label}
                </span>
              ))}
          </div>
        </section>

        {/* ── Metric Strip ── */}
        {metricCards.length > 0 && (
          <section>
            <div className={`grid grid-cols-2 md:grid-cols-3 ${GRID_COLS[Math.min(metricCards.length, 6)] || "lg:grid-cols-6"} gap-3`}>
              {metricCards.map((mc) => (
                <MetricCard key={mc.key} label={mc.label} value={mc.value} hint={mc.hint} color={mc.color} />
              ))}
            </div>
          </section>
        )}

        {/* ── Pipeline Section: 今日概览 ── */}
        {showTodayOverviewSection && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2
                  className="font-bold text-foreground leading-tight heading-font"
                  style={{ fontSize: "clamp(24px, 3vw, 32px)" }}
                >
                  {t("今日概览", "Today's Overview")}
                </h2>
                <p className="text-[12px] text-muted-foreground mt-1">{t("日程与待办事项", "Schedule & To-Dos")}</p>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${showScheduleOverview && showTodosOverview ? "lg:grid-cols-2" : ""} gap-4`}>
              {/* Today's Schedule */}
              {showScheduleOverview && (
                <div className="card-premium overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#5b88b5]" />
                      <span className="text-[14px] font-semibold text-foreground">{t("今日日程", "Today's Schedule")}</span>
                    </div>
                    <button
                      onClick={() => navigate("/schedule")}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                    >
                      {t("查看全部", "View all")} <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="py-1">
                    {todayEvents.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground px-4 py-6 text-center">{t("暂无安排", "No events")}</p>
                    ) : (
                      todayEvents.slice(0, 5).map((e: any) => (
                        <PipelineRow
                          key={e.id}
                          icon={<CalendarDays className="h-4 w-4 text-[#5b88b5]" />}
                          iconColor="bg-[#e1eaf4]"
                          title={e.title}
                          subtitle={e.start_time ? format(new Date(e.start_time), "HH:mm") : ""}
                          pill={e.importance === "重要" ? t("重要", "Important") : undefined}
                          pillColor="orange"
                          onClick={() => navigate("/schedule")}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Pending Todos */}
              {showTodosOverview && (
                <div className="card-premium overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-[#5b8c44]" />
                      <span className="text-[14px] font-semibold text-foreground">{t("待办事项", "To-Dos")}</span>
                    </div>
                    <button
                      onClick={() => navigate("/todos")}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                    >
                      {t("查看全部", "View all")} <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="py-1">
                    {pendingTodos.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground px-4 py-6 text-center">{t("无待办事项", "No to-dos")}</p>
                    ) : (
                      pendingTodos.slice(0, 5).map((todo: any) => (
                        <PipelineRow
                          key={todo.id}
                          icon={<CheckSquare className="h-4 w-4 text-[#5b8c44]" />}
                          iconColor="bg-[#dcead4]"
                          title={todo.title}
                          subtitle={todo.category || undefined}
                          pill={(todo.importance === "紧急" || todo.importance === "urgent") ? t("紧急", "Urgent") : (todo.importance === "重要" || todo.importance === "important") ? t("重要", "Important") : undefined}
                          pillColor={(todo.importance === "紧急" || todo.importance === "urgent") ? "orange" : (todo.importance === "重要" || todo.importance === "important") ? "yellow" : undefined}
                          onClick={() => navigate("/todos")}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Workflow Section: 生活模块 ── */}
        {lifeModuleCards.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2
                  className="font-bold text-foreground leading-tight heading-font"
                  style={{ fontSize: "clamp(24px, 3vw, 32px)" }}
                >
                  {t("生活模块", "Life Modules")}
                </h2>
                <p className="text-[12px] text-muted-foreground mt-1">{t("管理你的日常生活", "Manage your daily life")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {lifeModuleCards.map((card) => (
                <FeatureCard
                  key={card.id}
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  status={card.status}
                  statusColor={card.statusColor}
                  onClick={card.onClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Intelligence Layer: 数据洞察 ── */}
        {(() => {
          const [insightsExpanded, setInsightsExpanded] = useState(false);

          const primaryInsights = [
            isVisible("weight-loss") && {
              key: "weight-loss-trend",
              content: (
                <div key="weight-loss-trend" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/weight-loss")}>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-[#5a9da8]" />
                    <span className="text-[14px] font-semibold text-foreground">{t("体重趋势", "Weight Trend")}</span>
                  </div>
                  {weightTrend.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">{t("暂无记录", "No records")}</p>
                  ) : (
                    <div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[24px] font-semibold text-foreground font-mono-data">
                          {latestWeight?.toFixed(1)} <span className="text-[12px] text-muted-foreground font-normal">kg</span>
                        </p>
                        {weightDiff !== null && (
                          <span className={`text-[11px] font-medium ${weightDiff <= 0 ? "text-[#5a9da8]" : "text-[#d17847]"}`}>
                            {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)} kg
                          </span>
                        )}
                      </div>
                      {weightTrend.length >= 2 && (
                        <div className="h-10 mt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weightTrend.map((w: any) => ({ date: w.date, weight: Number(w.weight) }))}>
                              <Line type="monotone" dataKey="weight" stroke="#5a9da8" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ),
            },
            isVisible("finance") && {
              key: "finance-monthly",
              content: (
                <div key="finance-monthly" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/finance")}>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="h-4 w-4 text-[#d17847]" />
                    <span className="text-[14px] font-semibold text-foreground">{t("本月支出", "Monthly Spending")}</span>
                  </div>
                  <p className="text-[24px] font-semibold text-foreground font-mono-data">
                    ¥{totalSpending.toFixed(0)}
                    <span className="text-[12px] text-muted-foreground font-normal"> / ¥{budget.toLocaleString()}</span>
                  </p>
                  <Progress value={Math.min(100, (totalSpending / budget) * 100)} className="h-1 mt-3" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {Math.round((totalSpending / budget) * 100)}% {t("已使用", "used")}
                  </p>
                </div>
              ),
            },
            isVisible("weight-loss") && {
              key: "fasting-status",
              content: (
                <div key="fasting-status" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/weight-loss")}>
                  <div className="flex items-center gap-2 mb-3">
                    <Timer className="h-4 w-4 text-[#5a9da8]" />
                    <span className="text-[14px] font-semibold text-foreground">{t("16+8 断食", "16+8 Fasting")}</span>
                  </div>
                  <p className={`text-[20px] font-semibold ${isEatingWindow ? "text-[#5b8c44]" : "text-[#d17847]"}`}>
                    {isEatingWindow ? t("进食窗口", "Eating Window") : t("断食中", "Fasting")}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("进食:", "Eating:")} {String(Math.floor(eatingStartMin / 60)).padStart(2, "0")}:{String(eatingStartMin % 60).padStart(2, "0")} - {String(Math.floor(eatingEndMin / 60) % 24).padStart(2, "0")}:{String(eatingEndMin % 60).padStart(2, "0")}
                  </p>
                </div>
              ),
            },
            isVisible("pantry") && {
              key: "pantry-alert",
              content: (
                <div key="pantry-alert" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/pantry")}>
                  <div className="flex items-center gap-2 mb-3">
                    <Carrot className="h-4 w-4 text-[#c49840]" />
                    <span className="text-[14px] font-semibold text-foreground">{t("食材预警", "Pantry Alert")}</span>
                  </div>
                  {expiringPantry.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">{t("无即将过期食材", "No expiring items")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {expiringPantry.slice(0, 3).map((item: any) => {
                        const daysLeft = item.expiry_date
                          ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000)
                          : null;
                        return (
                          <div key={item.id} className="flex items-center justify-between">
                            <span className="text-[13px] text-foreground truncate max-w-[70%]">{item.name}</span>
                            <span className={`text-[11px] font-medium ${daysLeft !== null && daysLeft <= 1 ? "text-[#d17847]" : "text-[#c49840]"}`}>
                              {daysLeft !== null ? `${daysLeft} ${t("天", "d")}` : t("未知", "Unknown")}
                            </span>
                          </div>
                        );
                      })}
                      {expiringPantry.length > 3 && (
                        <p className="text-[11px] text-muted-foreground">+{expiringPantry.length - 3} {t("个食材", "items")}</p>
                      )}
                    </div>
                  )}
                </div>
              ),
            },
          ].filter(Boolean) as Array<{ key: string; content: React.ReactNode }>;

          const secondaryInsights = [
            isVisible("finance") && {
              key: "finance-budget-left",
              content: (
                <div key="finance-budget-left" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/finance")}>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-[#5b8c44]" />
                    <span className="text-[13px] font-semibold text-foreground">{t("剩余预算", "Budget Remaining")}</span>
                  </div>
                  <p className="text-[20px] font-semibold font-mono-data text-[#5b8c44]">
                    ¥{(budget - totalSpending).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {((1 - totalSpending / budget) * 100).toFixed(0)}% {t("剩余", "left")}
                  </p>
                </div>
              ),
            },
            isVisible("calories") && {
              key: "calories-target",
              content: (
                <div key="calories-target" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/calories")}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-[#5b88b5]" />
                    <span className="text-[13px] font-semibold text-foreground">{t("本周热量达标", "Calorie Target")}</span>
                  </div>
                  <p className="text-[20px] font-semibold font-mono-data text-foreground">
                    {weekCalorieDaysOnTarget}/{weekCalorieDaysTotal}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t("天达标", "days on target")}</p>
                </div>
              ),
            },
            isVisible("goals") && {
              key: "goals-monthly",
              content: (
                <div key="goals-monthly" className="card-premium p-4 cursor-pointer" onClick={() => navigate("/goals")}>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-4 w-4 text-[#8b7bb8]" />
                    <span className="text-[13px] font-semibold text-foreground">{t("月目标完成", "Monthly Goals")}</span>
                  </div>
                  <p className="text-[20px] font-semibold font-mono-data text-foreground">
                    {completedGoals}/{weekGoals.length}
                  </p>
                  <Progress value={weekGoals.length > 0 ? (completedGoals / weekGoals.length) * 100 : 0} className="h-1 mt-2" />
                </div>
              ),
            },
            (isVisible("schedule") || isVisible("learning-notes")) && {
              key: "study-hours",
              content: (
                <div key="study-hours" className="card-premium p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-[#5a9da8]" />
                    <span className="text-[13px] font-semibold text-foreground">{t("本周学习时间", "Study Hours")}</span>
                  </div>
                  <p className="text-[20px] font-semibold font-mono-data text-foreground">
                    {studyHours.toFixed(1)}<span className="text-[12px] text-muted-foreground font-normal">h</span>
                  </p>
                </div>
              ),
            },
          ].filter(Boolean) as Array<{ key: string; content: React.ReactNode }>;

          if (primaryInsights.length === 0 && secondaryInsights.length === 0) {
            return null;
          }

          return (
            <section>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2
                    className="font-bold text-foreground leading-tight heading-font"
                    style={{ fontSize: "clamp(24px, 3vw, 32px)" }}
                  >
                    {t("数据洞察", "Data Insights")}
                  </h2>
                  <p className="text-[12px] text-muted-foreground mt-1">{t("关键数据一目了然", "Key metrics at a glance")}</p>
                </div>
              </div>

              {primaryInsights.length > 0 && (
                <div className={`grid grid-cols-1 md:grid-cols-2 ${GRID_COLS[Math.min(primaryInsights.length, 4)] || "lg:grid-cols-4"} gap-3`}>
                  {primaryInsights.map((item) => item.content)}
                </div>
              )}

              {secondaryInsights.length > 0 && !insightsExpanded && (
                <button
                  onClick={() => setInsightsExpanded(true)}
                  className="w-full mt-3 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  {t("展开更多", "Show more")} <ChevronDown className="h-3 w-3" />
                </button>
              )}

              {secondaryInsights.length > 0 && insightsExpanded && (
                <>
                  <div className={`grid grid-cols-1 md:grid-cols-2 ${GRID_COLS[Math.min(secondaryInsights.length, 4)] || "lg:grid-cols-4"} gap-3 mt-3`}>
                    {secondaryInsights.map((item) => item.content)}
                  </div>
                  <button
                    onClick={() => setInsightsExpanded(false)}
                    className="w-full mt-3 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                  >
                    {t("收起", "Show less")} <ChevronDown className="h-3 w-3 rotate-180" />
                  </button>
                </>
              )}
            </section>
          );
        })()}

        {/* ── AI Assistant Promo ── */}
        <div
          className="flex items-center gap-3 p-4 rounded-[9px] border border-border bg-white cursor-pointer hover:border-[#c8c5bb] transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent("open-ai-chat"))}
        >
          <div className="h-10 w-10 rounded-lg bg-[#e7ddf1] flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-[#8b7bb8]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">{t("AI 助手", "AI Assistant")}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {t("点击打开 AI 助手，快速记录日程、记账、添加待办...", "Open AI assistant for quick schedule, finance, and to-do entries...")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#e4e1d7] shrink-0" />
        </div>

      </div>
    </AppLayout>
  );
}
