import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SectionDisclosure } from "@/components/ui/section-disclosure";
import { WeekAgenda } from "@/components/dashboard/WeekAgenda";
import {
  CalendarDays, Flame, Wallet, CheckSquare, Carrot, Package,
  Lightbulb, Target, TrendingDown, Timer, Kanban, Sparkles,
      ChevronRight, ArrowRight, CheckCircle2, Clock, GraduationCap, BookOpen,
  CalendarPlus, ListPlus, ReceiptText, CircleCheck, CalendarCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import {
  useTodaySchedule, useTodayCalorieSummary, useFinanceByMonth,
  useExpiringPantry, useOverdueDurables, useRecentThoughts, useSettings,
  useCurrentWeekGoals, useRecentWeightTrend, useProjects, todoHooks, useCaloriesByRange, useScheduleByRange,
  useTodayTasks,
} from "@/hooks/useData";
import { todayPickerItems } from "@/lib/habits";
import { usePrimaryExam, useTodayCivilPlans } from "@/hooks/useCivilService";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { getSubscriptionEvent, summarizeSubscriptions } from "@/lib/subscriptions";
import { useLocalDate } from "@/hooks/useLocalDate";
import { ArcScope } from "@/components/arc/ArcScope";
import AnimatedCounter from "@/vendor/uiarc/registry/components/animated-counter/animated-counter";
import { differenceInCalendarDays, parseISO, format, addDays, startOfWeek } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type DashboardDailyTask = Tables<"daily_tasks"> & {
  todos: Pick<Tables<"todos">, "title" | "importance" | "category" | "is_archived" | "is_completed"> | null;
};


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

function daysUntil(dateValue: string | null | undefined, now: Date): number | null {
  if (!dateValue) return null;
  const parsed = parseISO(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return differenceInCalendarDays(parsed, now);
}

function formatExpiryStatus(days: number | null, lang: "zh" | "en"): string {
  if (days === null) return lang === "zh" ? "日期未知" : "Date unknown";
  if (days < 0) return lang === "zh" ? `已过期 ${Math.abs(days)} 天` : `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return lang === "zh" ? "今天到期" : "Expires today";
  if (days === 1) return lang === "zh" ? "明天到期" : "Expires tomorrow";
  return lang === "zh" ? `${days} 天后到期` : `Expires in ${days}d`;
}

function formatExamCountdown(days: number | null, lang: "zh" | "en"): string {
  if (days === null) return "—";
  if (days < 0) return lang === "zh" ? "已结束" : "Finished";
  if (days === 0) return lang === "zh" ? "今天" : "Today";
  return lang === "zh" ? `${days}天` : `${days}d`;
}

function safePercent(value: number, total: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

const IMPORTANCE_RANK: Record<string, number> = {
  urgent: 0,
  紧急: 0,
  important: 1,
  重要: 1,
  normal: 2,
  普通: 2,
  low: 3,
  低优先: 3,
};

function importanceRank(value?: string | null) {
  if (!value) return IMPORTANCE_RANK["普通"];
  return IMPORTANCE_RANK[value] ?? IMPORTANCE_RANK["普通"];
}

function importanceMark(value?: string | null): { pill?: "urgent" | "important"; pillColor?: "red" | "yellow" } {
  if (value === "紧急" || value === "urgent") return { pill: "urgent", pillColor: "red" };
  if (value === "重要" || value === "important") return { pill: "important", pillColor: "yellow" };
  return {};
}

// Category accents — wired to --cat-* design tokens
const CAT = {
  green:  { text: "text-cat-green", bg: "bg-cat-green-bg", border: "border-cat-green-bg" },
  blue:   { text: "text-cat-blue", bg: "bg-cat-blue-bg", border: "border-cat-blue-bg" },
  orange: { text: "text-cat-orange", bg: "bg-cat-orange-bg", border: "border-cat-orange-bg" },
  teal:   { text: "text-cat-teal", bg: "bg-cat-teal-bg", border: "border-cat-teal-bg" },
  purple: { text: "text-cat-purple", bg: "bg-cat-purple-bg", border: "border-cat-purple-bg" },
  yellow: { text: "text-cat-yellow", bg: "bg-cat-yellow-bg", border: "border-cat-yellow-bg" },
  red:    { text: "text-cat-red", bg: "bg-cat-red-bg", border: "border-cat-red-bg" },
};

function MetricCard({ label, value, hint, color }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  color?: keyof typeof CAT;
}) {
  const c = color ? CAT[color] : null;
  return (
    <div data-testid="dashboard-metric" className="life-metric min-w-0">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="mt-1 text-foreground">
        {typeof value === "number" ? (
          <ArcScope className="inline-flex arc-metric-compact">
            <AnimatedCounter value={value} />
          </ArcScope>
        ) : (
          <p className="type-metric-compact font-mono-data tracking-tight">{value}</p>
        )}
      </div>
      {hint && (
        <p className={`text-caption mt-1 ${c ? c.text : "text-muted-foreground"}`}>{hint}</p>
      )}
    </div>
  );
}

function PipelineRow({ icon, iconColor, title, subtitle, pill, pillColor, to }: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle?: string;
  pill?: string;
  pillColor?: keyof typeof CAT;
  to: string;
}) {
  const pc = pillColor ? CAT[pillColor] : null;
  return (
    <Link
      to={to}
      className="pipeline-row w-full min-h-11 text-left flex items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-md group"
    >
      <span data-tone={iconColor} className="pipeline-icon flex h-8 w-8 items-center justify-center rounded-md shrink-0 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground line-clamp-2" title={title}>{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {pill && pc && (
        <span className={`status-text shrink-0 ${pc.text}`}>
          {pill}
        </span>
      )}
      <ChevronRight className="pipeline-arrow h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
    </Link>
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
      className="module-card w-full min-h-24 text-left card-premium p-4 cursor-pointer group focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="module-icon h-8 w-8 rounded-md bg-muted flex items-center justify-center">
          {icon}
        </div>
        {status && sc && (
          <span className={`status-text ${sc.text}`}>
            {status}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <ArrowRight aria-hidden="true" className="module-arrow h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [modulesExpanded, setModulesExpanded] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const todayStr = useLocalDate();
  const now = new Date();
  const { data: settings } = useSettings();
  const hiddenFeatures = settings?.hidden_features || [];
  const focusMode = (settings as any)?.app_focus_mode || "full";
  const isVisible = (id: string) => focusMode === "civil_service"
    ? id === "civil-service" : !hiddenFeatures.includes(id);
  // Secondary metrics can move into the first four slots when a primary module is hidden.
  const needsFallbackMetrics = ["schedule", "todos", "finance", "calories"].filter(isVisible).length < 4;
  const needsDetails = modulesExpanded || insightsExpanded;
  const weekStart = startOfWeek(parseISO(todayStr), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const { data: todayEvents = [] } = useTodaySchedule();
  const { data: todayCalories = 0 } = useTodayCalorieSummary();
  const { data: monthFinanceRecords = [] } = useFinanceByMonth(now.getFullYear(), now.getMonth() + 1);
  const { data: allTodos = [] }: { data?: Tables<"todos">[] } = todoHooks.useList();
  const { data: todayTasks = [] }: { data?: DashboardDailyTask[] } = useTodayTasks();
  const pendingTodos = allTodos.filter((todo: any) => !todo.is_completed && !todo.is_archived);
  const todayTodoIds = new Set<string>(todayTasks.map((task: { todo_id: string }) => task.todo_id));
  const openTodayTasks = todayTasks
    .filter((task) => !task.is_completed && task.todos?.title && !task.todos.is_archived && !task.todos.is_completed)
    .sort((a, b) => importanceRank(a.todos?.importance) - importanceRank(b.todos?.importance));
  const previewTodayTasks = openTodayTasks.slice(0, 5);
  const otherTodos = todayPickerItems(
    allTodos.filter((todo) => {
      if (todo.parent_id) return true;
      return !allTodos.some((child) => child.parent_id === todo.id && !child.is_completed && !child.is_archived);
    }),
    todayTodoIds,
  )
    .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance))
    .slice(0, 5);
  const { data: expiringPantry = [] } = useExpiringPantry();
  const subscriptionQuery = useSubscriptions(isVisible("belongings"));
  const subscriptionSummary = summarizeSubscriptions(subscriptionQuery.data ?? [], todayStr);
  const { data: overdueDurables = [] } = useOverdueDurables(modulesExpanded && isVisible("belongings"));
  const { data: recentThoughts = [] } = useRecentThoughts(modulesExpanded && isVisible("thoughts"));
  const weekGoalsQuery = useCurrentWeekGoals((needsDetails || needsFallbackMetrics) && isVisible("goals"));
  const { data: weekGoals = [] } = weekGoalsQuery;
  const weightTrendQuery = useRecentWeightTrend((needsDetails || needsFallbackMetrics) && isVisible("weight-loss"));
  const { data: weightTrend = [] } = weightTrendQuery;
  const { data: primaryExam } = usePrimaryExam((modulesExpanded || needsFallbackMetrics) && isVisible("civil-service"));
  const { data: todayCivilPlans = [] } = useTodayCivilPlans(modulesExpanded && isVisible("civil-service"));
  const { data: allProjects = [] } = useProjects((modulesExpanded || needsFallbackMetrics) && isVisible("projects"));
  const calorieHistory = useCaloriesByRange(format(weekStart, "yyyy-MM-dd"), todayStr, insightsExpanded && isVisible("calories"));
  const { data: weekCalorieRecords = [] } = calorieHistory;
  const scheduleHistory = useScheduleByRange(weekStart, weekEnd, isVisible("schedule") || isVisible("learning-notes"));
  const { data: weekScheduleEvents = [] } = scheduleHistory;
  const insightQueries = [weekGoalsQuery, weightTrendQuery, calorieHistory, scheduleHistory];
  const insightsLoading = insightQueries.some(query => query.isLoading);
  const insightsFailed = insightQueries.some(query => query.error);
  const activeProjects = allProjects.filter((p: any) => p.status === "active" || p.status === "planning");
  const avgProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((s: number, p: any) => s + p.progress, 0) / activeProjects.length)
    : 0;

  const calorieTarget = settings?.calorie_target ?? 2000;
  const budget = settings?.monthly_budget ?? 5000;
  const hasBudget = Number.isFinite(budget) && budget > 0;
  const totalSpending = monthFinanceRecords
    .filter((record: any) => record.date.startsWith(todayStr.slice(0, 7)))
    .reduce((sum: number, record: any) => sum + Number(record.amount_cny), 0);
  const urgentTodos = pendingTodos.filter((t: any) => t.importance === "紧急" || t.importance === "urgent");

  // Insights computation
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
  const studyHours = (weekScheduleEvents as any[])
    .filter((e: any) => {
      const start = new Date(e.start_time);
      return start >= weekStart && start < weekEnd && (e.color === "blue" || e.color === "teal");
    })
    .reduce((sum: number, e: any) => {
      const duration = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

  // KPI strip derived values
  const todayFinanceTotal = (monthFinanceRecords as any[])
    .filter((r) => r.date === todayStr)
    .reduce((sum, r) => sum + Number(r.amount_cny), 0);
  const completedTodos = (allTodos as any[]).filter((t) => t.is_completed && !t.is_archived).length;
  const totalTodos = (allTodos as any[]).filter((t) => !t.is_archived).length;
  const overdueTodoCount = (allTodos as any[]).filter(
    (t) => !t.is_completed && !t.is_archived && t.due_date && t.due_date.slice(0, 10) < todayStr
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
  // Fasting calculation
  const fastingStartHour = settings?.fasting_start_hour ?? 12;
  const fastingStartMinute = (settings as any)?.fasting_start_minute ?? 0;
  const eatingStartMin = fastingStartHour * 60 + fastingStartMinute;
  const eatingEndMin = (eatingStartMin + 8 * 60) % (24 * 60);
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();
  const isEatingWindow = eatingEndMin > eatingStartMin
    ? currentTotalMin >= eatingStartMin && currentTotalMin < eatingEndMin
    : currentTotalMin >= eatingStartMin || currentTotalMin < eatingEndMin;

  // Weight trend data
  const latestWeight = weightTrend.length > 0 ? Number(weightTrend[weightTrend.length - 1]?.weight) : null;
  const weightDiff = weightTrend.length >= 2
    ? Number(weightTrend[weightTrend.length - 1]?.weight) - Number(weightTrend[0]?.weight)
    : null;

  const civilDaysLeft = primaryExam
    ? differenceInCalendarDays(parseISO(primaryExam.exam_date), now)
    : null;
  const civilPlanDone = todayCivilPlans.filter((p) => p.is_completed).length;

  const pantryItems = expiringPantry.map((item: any) => ({
    item,
    days: daysUntil(item.expiry_date, now),
  }));
  const overduePantryItems = pantryItems.filter(({ days }) => days !== null && days < 0);
  const dueSoonPantryItems = pantryItems.filter(({ days }) => days !== null && days >= 0 && days <= 3);
  const metricCards = [
    isVisible("todos") && {
      key: "todos",
      label: t("待办进度", "To-Do Progress"),
      value: totalTodos > 0 ? `${completedTodos}/${totalTodos}` : "—",
      hint: totalTodos === 0
        ? t("添加第一个待办", "Add your first to-do")
        : overdueTodoCount > 0
          ? `${overdueTodoCount} ${t("项逾期", "overdue")}`
          : t("无逾期", "No overdue"),
      color: (overdueTodoCount > 0 ? "orange" : "green") as keyof typeof CAT,
    },
    isVisible("finance") && {
      key: "finance",
      label: t("今日支出", "Today's Spending"),
      value: `¥${todayFinanceTotal.toFixed(0)}`,
      hint: hasBudget
        ? (lang === "zh" ? `本月 ¥${totalSpending.toFixed(0)}` : `This month ¥${totalSpending.toFixed(0)}`)
        : t("尚未设置月预算", "Monthly budget not set"),
      color: "orange" as const,
    },
    isVisible("calories") && {
      key: "calories",
      label: t("剩余热量", "Calories Remaining"),
      value: calorieTarget > 0 ? remainingCalories : "—",
      hint: calorieTarget > 0
        ? <>{todayCalories} / <span className="whitespace-nowrap">{calorieTarget} kcal</span></>
        : t("尚未设置热量目标", "Calorie target not set"),
      color: (remainingCalories < 0 ? "orange" : "green") as keyof typeof CAT,
    },
    isVisible("goals") && {
      key: "goals",
      label: t("本周目标", "Weekly Goals"),
      value: weekGoals.length > 0 ? `${goalProgressPct}%` : "—",
      hint: weekGoals.length > 0
        ? `${completedGoals}/${weekGoals.length} ${t("已完成", "done")}`
        : t("尚未设置", "Not set"),
      color: "green" as const,
    },
    isVisible("projects") && {
      key: "projects",
      label: t("活跃项目", "Active Projects"),
      value: activeProjects.length,
      hint: activeProjects.length > 0 ? `${t("平均进度", "Avg progress")} ${avgProgress}%` : t("暂无活跃项目", "No active projects"),
      color: "purple" as const,
    },
    isVisible("civil-service") && primaryExam && {
      key: "civil-service",
      label: t("考公倒计时", "Exam Countdown"),
      value: formatExamCountdown(civilDaysLeft, lang),
      hint: primaryExam.name,
      color: "orange" as const,
    },
    isVisible("weight-loss") && latestWeight !== null && Number.isFinite(latestWeight) && {
      key: "weight-loss",
      label: t("最新体重", "Weight"),
      value: `${latestWeight.toFixed(1)}kg`,
      hint: weightDiff !== null && Number.isFinite(weightDiff) ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}kg` : undefined,
      color: "teal" as const,
    },
  ].filter(Boolean).slice(0, isVisible("schedule") ? 3 : 4) as Array<{
    key: string;
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    color?: keyof typeof CAT;
  }>;

  const lifeModuleCards = [
    isVisible("schedule") && {
      id: "schedule",
      icon: <CalendarDays className="h-4 w-4 text-foreground" />,
      title: t("日程计划", "Schedule"),
      description: `${todayEvents.length} ${lang === "zh" ? "个今日日程" : "events today"}`,
      status: todayEvents.length > 0 ? `${todayEvents.length}` : undefined,
      statusColor: "blue" as const,
      onClick: () => navigate("/schedule"),
    },
    isVisible("finance") && {
      id: "finance",
      icon: <Wallet className="h-4 w-4 text-foreground" />,
      title: t("记账", "Finance"),
      description: hasBudget
        ? (lang === "zh" ? `本月 ¥${totalSpending.toFixed(0)}` : `This month ¥${totalSpending.toFixed(0)}`)
        : t("尚未设置月预算", "Monthly budget not set"),
      status: hasBudget && totalSpending > budget ? t("超支", "Over") : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/finance"),
    },
    isVisible("calories") && {
      id: "calories",
      icon: <Flame className="h-4 w-4 text-foreground" />,
      title: t("热量记录", "Calories"),
      description: calorieTarget > 0 ? `${todayCalories} / ${calorieTarget} kcal` : t("尚未设置目标", "Target not set"),
      status: calorieTarget > 0 && remainingCalories < 0 ? t("超额", "Over") : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/calories"),
    },
    isVisible("todos") && {
      id: "todos",
      icon: <CheckSquare className="h-4 w-4 text-foreground" />,
      title: t("待办事项", "To-Dos"),
      description: pendingTodos.length > 0 ? `${pendingTodos.length} ${t("个待完成", "pending")}` : t("今天没有待办", "Nothing pending today"),
      status: urgentTodos.length > 0 ? `${urgentTodos.length} ${t("紧急", "urgent")}` : undefined,
      statusColor: "red" as const,
      onClick: () => navigate("/todos"),
    },
    isVisible("pantry") && {
      id: "pantry",
      icon: <Carrot className="h-4 w-4 text-foreground" />,
      title: t("食材管理", "Pantry"),
      description: overduePantryItems.length > 0
        ? `${overduePantryItems.length} ${t("个已过期", "expired")}`
        : dueSoonPantryItems.length > 0
          ? `${dueSoonPantryItems.length} ${t("个即将到期", "expiring soon")}`
          : t("暂无到期提醒", "No expiry alerts"),
      status: overduePantryItems.length > 0 ? `${overduePantryItems.length}` : dueSoonPantryItems.length > 0 ? `${dueSoonPantryItems.length}` : undefined,
      statusColor: (overduePantryItems.length > 0 ? "orange" : "yellow") as keyof typeof CAT,
      onClick: () => navigate("/pantry"),
    },
    isVisible("belongings") && {
      id: "belongings",
      icon: <Package className="h-4 w-4 text-foreground" />,
      title: t("用品管理", "Belongings"),
      description: subscriptionQuery.error ? t("订阅提醒加载失败", "Subscription alerts unavailable") : subscriptionSummary.needsAttention > 0
        ? `${subscriptionSummary.needsAttention} ${t("项订阅需要留意", "subscriptions need attention")}`
        : overdueDurables.length > 0
        ? `${overdueDurables.length} ${t("个已超过预期使用期", "past expected lifespan")}`
        : t("暂无超期用品", "No overdue items"),
      status: subscriptionSummary.needsAttention > 0 ? `${subscriptionSummary.needsAttention}` : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate(subscriptionSummary.needsAttention > 0 ? "/belongings?tab=subscriptions" : "/belongings"),
    },
    isVisible("goals") && {
      id: "goals",
      icon: <Target className="h-4 w-4 text-foreground" />,
      title: t("目标", "Goals"),
      description: weekGoals.length > 0
        ? `${completedGoals}/${weekGoals.length} ${t("本周已完成", "done this week")}`
        : t("尚未设置本周目标", "No weekly goals yet"),
      status: weekGoals.length > 0 && goalProgressPct > 0 ? `${goalProgressPct}%` : undefined,
      statusColor: "green" as const,
      onClick: () => navigate("/goals"),
    },
    isVisible("projects") && {
      id: "projects",
      icon: <Kanban className="h-4 w-4 text-foreground" />,
      title: t("项目管理", "Projects"),
      description: activeProjects.length > 0 ? `${activeProjects.length} ${t("个活跃项目", "active projects")}` : t("暂无活跃项目", "No active projects"),
      status: avgProgress > 0 ? `${avgProgress}%` : undefined,
      statusColor: "blue" as const,
      onClick: () => navigate("/projects"),
    },
    isVisible("weight-loss") && {
      id: "weight-loss",
      icon: <TrendingDown className="h-4 w-4 text-foreground" />,
      title: t("减肥专项", "Weight Loss"),
      description: latestWeight !== null && Number.isFinite(latestWeight) ? `${latestWeight.toFixed(1)} kg` : t("暂无记录", "No records"),
      status: weightDiff !== null && Number.isFinite(weightDiff) ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}` : undefined,
      statusColor: (weightDiff !== null && weightDiff <= 0 ? "teal" : "orange") as keyof typeof CAT,
      onClick: () => navigate("/weight-loss"),
    },
    isVisible("civil-service") && {
      id: "civil-service",
      icon: <GraduationCap className="h-4 w-4 text-foreground" />,
      title: t("考公", "Civil Service"),
      description: primaryExam
        ? `${primaryExam.name} · ${t("今日计划", "Today")} ${civilPlanDone}/${todayCivilPlans.length}`
        : t("添加考试倒计时", "Add exam countdown"),
      status: primaryExam ? formatExamCountdown(civilDaysLeft, lang) : undefined,
      statusColor: "orange" as const,
      onClick: () => navigate("/civil-service"),
    },
    isVisible("thoughts") && {
      id: "thoughts",
      icon: <Lightbulb className="h-4 w-4 text-foreground" />,
      title: t("随想", "Thoughts"),
      description: recentThoughts.length > 0 ? `${recentThoughts.length} ${t("条最近记录", "recent records")}` : t("暂无随想", "No thoughts"),
      onClick: () => navigate("/thoughts"),
    },
    isVisible("learning-notes") && {
      id: "learning-notes",
      icon: <BookOpen className="h-4 w-4 text-foreground" />,
      title: t("学习笔记", "Learning Notes"),
      description: t("查看与优化学习笔记", "View and optimize notes"),
      onClick: () => navigate("/learning-notes"),
    },
    isVisible("fortune") && {
      id: "fortune",
      icon: <Sparkles className="h-4 w-4 text-foreground" />,
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

  const quickActions = [
    isVisible("schedule") && { key: "schedule", label: t("添加日程", "Add schedule"), to: "/schedule?new=1", icon: CalendarPlus, color: "text-cat-blue bg-cat-blue-bg" },
    isVisible("todos") && { key: "todos", label: t("新增待办", "Add to-do"), to: "/todos?new=1", icon: ListPlus, color: "text-cat-green bg-cat-green-bg" },
    isVisible("finance") && { key: "finance", label: t("记一笔", "Add expense"), to: "/finance?new=1", icon: ReceiptText, color: "text-cat-orange bg-cat-orange-bg" },
  ].filter(Boolean) as Array<{ key: string; label: string; to: string; icon: React.ElementType; color: string }>;

  const budgetUsedPercent = safePercent(totalSpending, budget);
  const budgetRemainingPercent = hasBudget ? safePercent(Math.max(0, budget - totalSpending), budget) : null;
  const showTodosOverview = isVisible("todos");
  const attention = [
    ...(isVisible("todos") && overdueTodoCount > 0 ? [{
      key: "overdue-todos",
      to: "/todos",
      title: t(`${overdueTodoCount} 项待办过了期限`, `${overdueTodoCount} to-dos are overdue`),
      meta: "",
      tone: "tone-danger",
      label: t("打开逾期待办", "Open overdue to-dos"),
    }] : []),
    ...(isVisible("pantry") ? pantryItems
      .filter(({ days }) => days !== null && days <= 3)
      .sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
      .slice(0, 3)
      .map(({ item, days }) => ({
        key: `pantry-${item.id}`,
        to: "/pantry",
        title: item.name,
        meta: formatExpiryStatus(days, lang),
        tone: days !== null && days < 0 ? "tone-danger" : "tone-warn",
        label: `${t("打开食材预警", "Open pantry alert")}：${item.name} ${formatExpiryStatus(days, lang)}`,
      })) : []),
    ...(isVisible("belongings") ? (subscriptionQuery.data ?? [])
      .map((item) => ({ item, event: getSubscriptionEvent(item, todayStr) }))
      .filter((row) => row.event?.needsAttention)
      .sort((a, b) => a.item.next_date.localeCompare(b.item.next_date))
      .slice(0, 2)
      .map(({ item, event }) => ({
        key: `sub-${item.id}`,
        to: "/belongings",
        title: item.name,
        meta: !event || event.overdue
          ? t("待确认", "Needs confirmation")
          : event.days === 0
            ? (event.kind === "trial" ? t("今天试用结束", "Trial ends today") : event.kind === "expiry" ? t("今天到期", "Expires today") : t("今天扣款", "Charge today"))
            : event.kind === "trial"
              ? t(`${event.days} 天后试用结束`, `Trial ends in ${event.days}d`)
              : event.kind === "expiry"
                ? t(`${event.days} 天后到期`, `Expires in ${event.days}d`)
                : t(`${event.days} 天后扣款`, `Charge in ${event.days}d`),
        tone: "tone-warn",
        label: t(`打开订阅 ${item.name}`, `Open subscription ${item.name}`),
      })) : []),
    ...(isVisible("finance") && hasBudget && totalSpending > budget ? [{
      key: "budget",
      to: "/finance",
      title: t("本月支出已超出预算", "Spending is over budget"),
      meta: `¥${Math.round(totalSpending - budget)}`,
      tone: "tone-danger",
      label: t("打开记账", "Open finance"),
    }] : []),
    ...(isVisible("calories") && todayCalories > calorieTarget ? [{
      key: "calories",
      to: "/calories",
      title: t("今日热量已超出", "Calories are over target"),
      meta: `${Math.round(todayCalories - calorieTarget)} kcal`,
      tone: "tone-warn",
      label: t("打开热量记录", "Open calories"),
    }] : []),
  ].slice(0, 4);

  const insightCards = [
    isVisible("weight-loss") && (
      <button
        key="weight"
        type="button"
        aria-label={t("打开体重趋势", "Open weight trend")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/weight-loss")}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="h-4 w-4 text-cat-teal" />
          <span className="text-sm font-semibold">{t("体重趋势", "Weight Trend")}</span>
        </div>
        {latestWeight !== null && Number.isFinite(latestWeight) ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="type-metric-compact font-mono-data">{latestWeight.toFixed(1)} <span className="text-xs text-muted-foreground font-normal">kg</span></p>
            {weightDiff !== null && Number.isFinite(weightDiff) && (
              <span className={`text-caption font-medium ${weightDiff <= 0 ? "text-cat-teal" : "text-cat-orange"}`}>
                {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)} kg
              </span>
            )}
          </div>
        ) : <p className="text-sm text-muted-foreground">{t("暂无记录，点击添加", "No records yet")}</p>}
      </button>
    ),
    isVisible("finance") && (
      <button
        key="finance"
        type="button"
        aria-label={t("打开本月支出", "Open monthly spending")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/finance")}
      >
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-cat-orange" />
          <span className="text-sm font-semibold">{t("本月支出", "Monthly Spending")}</span>
        </div>
        <p className="type-metric-compact font-mono-data">¥{totalSpending.toFixed(0)}</p>
        {hasBudget && budgetUsedPercent !== null ? (
          <>
            <Progress value={budgetUsedPercent} className="h-1 mt-3" />
            <p className="text-caption text-muted-foreground mt-1">{Math.round(budgetUsedPercent)}% {t("已使用", "used")}</p>
          </>
        ) : <p className="text-caption text-muted-foreground mt-1">{t("尚未设置月预算", "Monthly budget not set")}</p>}
      </button>
    ),
    isVisible("weight-loss") && (
      <button
        key="fasting"
        type="button"
        aria-label={t("打开断食计划", "Open fasting plan")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/weight-loss")}
      >
        <div className="flex items-center gap-2 mb-3">
          <Timer className="h-4 w-4 text-cat-teal" />
          <span className="text-sm font-semibold">{t("16+8 断食", "16+8 Fasting")}</span>
        </div>
        <p className={`type-metric-compact font-semibold ${isEatingWindow ? "text-cat-green" : "text-cat-orange"}`}>
          {isEatingWindow ? t("进食窗口", "Eating Window") : t("断食中", "Fasting")}
        </p>
        <p className="text-caption text-muted-foreground mt-1">
          {t("进食", "Eating")} {String(Math.floor(eatingStartMin / 60)).padStart(2, "0")}:{String(eatingStartMin % 60).padStart(2, "0")}–{String(Math.floor(eatingEndMin / 60) % 24).padStart(2, "0")}:{String(eatingEndMin % 60).padStart(2, "0")}
        </p>
      </button>
    ),
    isVisible("pantry") && (
      <button
        key="pantry"
        type="button"
        aria-label={t("打开食材预警", "Open pantry alerts")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/pantry")}
      >
        <div className="flex items-center gap-2 mb-3">
          <Carrot className="h-4 w-4 text-cat-yellow" />
          <span className="text-sm font-semibold">{t("食材预警", "Pantry Alerts")}</span>
        </div>
        {pantryItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("暂无到期提醒", "No expiry alerts")}</p>
        ) : (
          <div className="space-y-1.5">
            {pantryItems.slice(0, 3).map(({ item, days }) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-sm truncate">{item.name}</span>
                <span className={`text-caption font-medium shrink-0 ${days !== null && days <= 0 ? "text-cat-orange" : "text-cat-yellow"}`}>
                  {formatExpiryStatus(days, lang)}
                </span>
              </div>
            ))}
          </div>
        )}
      </button>
    ),
    isVisible("finance") && (
      <button
        key="budget"
        type="button"
        aria-label={t("打开剩余预算", "Open remaining budget")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/finance")}
      >
        <div className="flex items-center gap-2 mb-3"><Target className="h-4 w-4 text-cat-green" /><span className="text-sm font-semibold">{t("剩余预算", "Budget Remaining")}</span></div>
        {hasBudget ? (
          <>
            <p className="type-metric-compact font-mono-data text-cat-green">¥{(budget - totalSpending).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-caption text-muted-foreground mt-1">{Math.round(budgetRemainingPercent ?? 0)}% {t("剩余", "left")}</p>
          </>
        ) : <p className="text-sm text-muted-foreground">{t("尚未设置月预算", "Monthly budget not set")}</p>}
      </button>
    ),
    isVisible("calories") && (
      <button
        key="calories"
        type="button"
        aria-label={t("打开本周热量达标", "Open weekly calorie target")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/calories")}
      >
        <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="h-4 w-4 text-cat-blue" /><span className="text-sm font-semibold">{t("本周热量达标", "Weekly Calorie Target")}</span></div>
        <p className="type-metric-compact font-mono-data">{weekCalorieDaysTotal > 0 ? `${weekCalorieDaysOnTarget}/${weekCalorieDaysTotal}` : "—"}</p>
        <p className="text-caption text-muted-foreground mt-1">{weekCalorieDaysTotal > 0 ? t("天达标", "days on target") : t("本周暂无记录", "No records this week")}</p>
      </button>
    ),
    isVisible("goals") && (
      <button
        key="goals"
        type="button"
        aria-label={t("打开本周目标完成情况", "Open weekly goals")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate("/goals")}
      >
        <div className="flex items-center gap-2 mb-3"><CircleCheck className="h-4 w-4 text-cat-purple" /><span className="text-sm font-semibold">{t("本周目标完成", "Weekly Goals")}</span></div>
        {weekGoals.length > 0 ? (
          <>
            <p className="type-metric-compact font-mono-data">{completedGoals}/{weekGoals.length}</p>
            <Progress value={goalProgressPct} className="h-1 mt-3" />
          </>
        ) : <p className="text-sm text-muted-foreground">{t("尚未设置本周目标", "No weekly goals yet")}</p>}
      </button>
    ),
    (isVisible("schedule") || isVisible("learning-notes")) && (
      <button
        key="study"
        type="button"
        aria-label={t("打开本周学习时间", "Open weekly study time")}
        className="card-premium min-h-32 p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate(isVisible("learning-notes") ? "/learning-notes" : "/schedule")}
      >
        <div className="flex items-center gap-2 mb-3"><Clock className="h-4 w-4 text-cat-teal" /><span className="text-sm font-semibold">{t("本周学习时间", "Study Time This Week")}</span></div>
        <p className="type-metric-compact font-mono-data">{studyHours.toFixed(1)}<span className="text-xs text-muted-foreground font-normal">h</span></p>
      </button>
    ),
  ].filter(Boolean) as React.ReactNode[];

  return (
    <AppLayout title={t("首页概览", "Dashboard")} header={false}>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="type-dashboard-display heading-font text-foreground">{greeting}</h1>
          </div>
          <nav aria-label={t("快捷记录", "Quick capture")} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.key} variant="outline" asChild className="capture-button min-h-11 justify-start px-3">
                  <Link to={action.to} aria-label={action.label}>
                    <span className="capture-icon flex h-6 w-6 items-center justify-center rounded-[5px] bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
                    <span>{action.label}</span>
                  </Link>
                </Button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              aria-label={t("打开 AI 助手", "Open AI Assistant")}
              className="capture-button min-h-11 justify-start px-3"
              onClick={() => window.dispatchEvent(new CustomEvent("open-ai-chat"))}
            >
              <span className="capture-icon flex h-6 w-6 items-center justify-center rounded-[5px] bg-muted text-muted-foreground"><Sparkles className="h-4 w-4" /></span>
              <span>{t("AI 快速记", "AI capture")}</span>
            </Button>
          </nav>
        </section>

        <div className="space-y-3">
          {isVisible("schedule") && <WeekAgenda events={weekScheduleEvents} weekStart={weekStart} today={todayStr}
            loading={scheduleHistory.isLoading} failed={!!scheduleHistory.error} onRetry={() => void scheduleHistory.refetch?.()} />}
          {metricCards.length > 0 && (
            <div role="region" aria-label={t("今日关键数据", "Today's key metrics")} className="dashboard-metrics card-premium overflow-hidden"
              style={{ "--metric-columns": metricCards.length } as React.CSSProperties}>
              {metricCards.map(({ key, ...metric }) => <MetricCard key={key} {...metric} />)}
            </div>
          )}
        </div>

        {showTodosOverview && (
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="type-section-title heading-font">{t("优先待办", "Priority to-dos")}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card-premium overflow-hidden" role="region" aria-label={t("今日待办", "Today's to-dos")}>
                <div className="min-h-11 flex items-center justify-between gap-3 px-4 border-b border-border">
                  <div className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold">{t("今日待办", "Today's to-dos")}</span></div>
                  <Link to="/today" aria-label={t("查看全部今日待办", "View all of today's to-dos")} className="min-h-11 inline-flex items-center gap-1 px-2 text-caption text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-md">{t("查看全部", "View all")}<ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="pipeline-list p-1.5">
                  {openTodayTasks.length === 0 ? (
                    <div className="px-4 py-5 text-center">
                      <p className="text-sm text-muted-foreground">{todayTasks.length > 0 ? t("今天的待办都完成了", "Today's to-dos are done") : t("今天还没有待办", "Nothing on today yet")}</p>
                      <Link to="/today" className="min-h-11 mt-2 inline-flex items-center text-sm font-medium text-foreground underline underline-offset-4">{t("去添加今日待办", "Add to today")}</Link>
                    </div>
                  ) : previewTodayTasks.map((task) => {
                    const mark = importanceMark(task.todos?.importance);
                    return (
                      <PipelineRow key={task.id} icon={<CalendarCheck className="h-4 w-4" />} iconColor="bg-cat-green-bg" title={task.todos.title} subtitle={task.todos.category || undefined} pill={mark.pill === "urgent" ? t("紧急", "Urgent") : mark.pill === "important" ? t("重要", "Important") : undefined} pillColor={mark.pillColor} to="/today" />
                    );
                  })}
                </div>
              </div>
              <div className="card-premium overflow-hidden" role="region" aria-label={t("其他待办", "Other to-dos")}>
                <div className="min-h-11 flex items-center justify-between gap-3 px-4 border-b border-border">
                  <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold">{t("其他待办", "Other to-dos")}</span></div>
                  <Link to="/todos" aria-label={t("查看全部待办", "View all to-dos")} className="min-h-11 inline-flex items-center gap-1 px-2 text-caption text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-md">{t("查看全部", "View all")}<ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="pipeline-list p-1.5">
                  {otherTodos.length === 0 ? (
                    <div className="px-4 py-5 text-center">
                      <p className="text-sm text-muted-foreground">{t("没有还没加入今天的待办", "Every open to-do is already on today")}</p>
                      <Link to="/todos?new=1" className="min-h-11 mt-2 inline-flex items-center text-sm font-medium text-foreground underline underline-offset-4">{t("新增待办", "Add to-do")}</Link>
                    </div>
                  ) : otherTodos.map((todo) => {
                    const mark = importanceMark(todo.importance);
                    return (
                      <PipelineRow key={todo.id} icon={<CheckSquare className="h-4 w-4" />} iconColor="bg-cat-green-bg" title={todo.title} subtitle={todo.category || undefined} pill={mark.pill === "urgent" ? t("紧急", "Urgent") : mark.pill === "important" ? t("重要", "Important") : undefined} pillColor={mark.pillColor} to="/todos" />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {attention.length > 0 && (
          <section aria-label={t("需要留意", "Needs attention")} className="card-premium px-4">
            <h2 className="pt-4 pb-2 text-sm font-semibold">{t("需要留意", "Needs attention")}</h2>
            <ul className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 divide-y divide-border lg:divide-y-0 pb-2">
              {attention.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-label={item.label}
                    className="capture-action flex min-h-11 w-full items-center gap-3 rounded-md py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(item.to)}
                  >
                    <span className={`status-text shrink-0 ${item.tone}`} />
                    <span className="min-w-0 flex-1 text-sm">{item.title}</span>
                    {item.meta && <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lifeModuleCards.length > 0 && (
          <SectionDisclosure title={t("全部模块", "All modules")} open={modulesExpanded} onOpenChange={setModulesExpanded} expandLabel={t("展开", "Expand")} collapseLabel={t("收起", "Collapse")} count={lifeModuleCards.length} actionLabel={modulesExpanded ? t("收起全部模块", "Collapse all modules") : t("展开全部模块", "Expand all modules")}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {lifeModuleCards.map((card) => <FeatureCard key={card.id} {...card} />)}
              </div>
          </SectionDisclosure>
        )}

        {insightCards.length > 0 && (
          <SectionDisclosure title={t("状态洞察", "Status insights")} open={insightsExpanded} onOpenChange={setInsightsExpanded} expandLabel={t("展开状态洞察", "Expand insights")} collapseLabel={t("收起洞察", "Collapse insights")}>
            {insightsLoading ? (
              <p role="status" className="text-sm text-muted-foreground">{t("正在加载本周洞察…", "Loading this week's insights…")}</p>
            ) : insightsFailed ? (
              <div role="alert" className="flex items-center gap-3 text-sm">
                <p>{t("洞察数据未能加载，请重试。", "Couldn't load insights. Please retry.")}</p>
                <button type="button" className="min-h-11 rounded-md border border-border px-3 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => insightQueries.filter(query => query.error).forEach(query => { void query.refetch(); })}>
                  {t("重试", "Retry")}
                </button>
              </div>
            ) : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{insightCards}</div>}
          </SectionDisclosure>
        )}
      </div>
    </AppLayout>
  );
}
