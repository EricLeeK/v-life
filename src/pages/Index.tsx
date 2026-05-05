import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Flame, Wallet, CheckSquare, Carrot, Package, Lightbulb, Target, TrendingDown, Timer, Kanban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useTodaySchedule, useTodayCalorieSummary, useTodayCalorieBreakdown, useMonthFinanceSummary, useFinanceByMonth,
  usePendingTodos, useExpiringPantry, useOverdueDurables, useRecentThoughts, useSettings,
  useCurrentWeekGoals, useRecentWeightTrend, useProjects, todoHooks,
} from "@/hooks/useData";
import { format } from "date-fns";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const WEEKDAYS_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getGreeting(hour: number): string {
  if (hour < 6) return "凌晨好";
  if (hour < 12) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function KpiTile({
  label,
  value,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  hintTone?: "muted" | "warning" | "success";
}) {
  const hintClass =
    hintTone === "warning"
      ? "text-warning"
      : hintTone === "success"
      ? "text-success"
      : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground mt-1 leading-tight">{value}</p>
        {hint !== undefined && hint !== null && (
          <p className={`text-[11px] mt-1 ${hintClass}`}>{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardCard({ title, icon: Icon, children, onClick, className = "" }: { title: string; icon: React.ElementType; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <Card className={`cursor-pointer hover:border-primary/30 transition-colors ${className}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
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
  const { data: allProjects = [] } = useProjects();
  const activeProjects = allProjects.filter((p: any) => p.status === "active" || p.status === "planning");
  const avgProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((s: number, p: any) => s + p.progress, 0) / activeProjects.length)
    : 0;

  const calorieTarget = settings?.calorie_target || 2000;
  const budget = settings?.monthly_budget || 5000;
  const totalSpending = financeSummary?.total || 0;
  const urgentTodos = pendingTodos.filter((t: any) => t.importance === "紧急");

  // ----- KPI strip derived values -----
  const todayStr = format(now, "yyyy-MM-dd");
  const todayFinanceTotal = (monthFinanceRecords as any[])
    .filter((r) => r.date === todayStr)
    .reduce((sum, r) => sum + Number(r.amount_cny), 0);
  const completedTodos = (allTodos as any[]).filter((t) => t.is_completed).length;
  const totalTodos = (allTodos as any[]).length;
  const overdueTodoCount = (allTodos as any[]).filter(
    (t) => !t.is_completed && t.due_date && new Date(t.due_date) < now
  ).length;
  const completedGoals = (weekGoals as any[]).filter((g) => g.is_completed).length;
  const goalProgressPct = weekGoals.length > 0
    ? Math.round((completedGoals / weekGoals.length) * 100)
    : 0;
  const remainingCalories = calorieTarget - todayCalories;

  const greeting = getGreeting(now.getHours());
  const dateLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS_ZH[now.getDay()]}`;

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

  return (
    <AppLayout title="首页概览">
      <div className="space-y-6 max-w-7xl">
        {/* Hero band */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
            <p className="text-sm text-muted-foreground mt-1">{dateLabel}</p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile
            label="今日日程"
            value={todayEvents.length}
            hint={nextEvent ? `下一个 ${format(new Date((nextEvent as any).start_time), "HH:mm")}` : "暂无安排"}
          />
          <KpiTile
            label="今日支出"
            value={`¥${todayFinanceTotal.toFixed(0)}`}
            hint={`本月 ¥${totalSpending.toFixed(0)}`}
          />
          <KpiTile
            label="剩余热量"
            value={`${remainingCalories} kcal`}
            hint={`目标 ${calorieTarget}`}
            hintTone={remainingCalories < 0 ? "warning" : "muted"}
          />
          <KpiTile
            label="待办完成"
            value={`${completedTodos}/${totalTodos}`}
            hint={overdueTodoCount > 0 ? `${overdueTodoCount} 项逾期` : "暂无逾期"}
            hintTone={overdueTodoCount > 0 ? "warning" : "muted"}
          />
          <KpiTile
            label="本周目标"
            value={`${completedGoals}/${weekGoals.length}`}
            hint={`${goalProgressPct}% 完成`}
            hintTone={goalProgressPct >= 50 ? "success" : "muted"}
          />
        </div>

        {/* 12-col card grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <DashboardCard title="今日日程" icon={CalendarDays} onClick={() => navigate("/schedule")} className="md:col-span-6">
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无安排</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.slice(0, 3).map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="text-sm text-foreground truncate">{e.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(e.start_time), "HH:mm")}
                    </span>
                  </div>
                ))}
                {todayEvents.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{todayEvents.length - 3} 个日程</p>
                )}
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="待办事项" icon={CheckSquare} onClick={() => navigate("/todos")} className="md:col-span-6">
            {pendingTodos.length === 0 ? (
              <p className="text-sm text-muted-foreground">无待办</p>
            ) : (
              <div className="space-y-2">
                {pendingTodos.slice(0, 3).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-foreground truncate">{t.title}</span>
                    </div>
                    <Badge
                      variant={t.importance === "紧急" ? "destructive" : "secondary"}
                      className="text-[10px] px-1.5 py-0 shrink-0 ml-2"
                    >
                      {t.importance}
                    </Badge>
                  </div>
                ))}
                {pendingTodos.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{pendingTodos.length - 3} 个待办</p>
                )}
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="本月支出" icon={Wallet} onClick={() => navigate("/finance")} className="md:col-span-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">¥{totalSpending.toFixed(2)}</span>
                <span className="text-muted-foreground">/ ¥{budget.toLocaleString()}</span>
              </div>
              <Progress value={Math.min(100, (totalSpending / budget) * 100)} className="h-2" />
              {(monthFinanceRecords as any[]).length > 0 && (
                <div className="space-y-1 pt-1">
                  {(monthFinanceRecords as any[]).slice(0, 3).map((r) => (
                    <div key={r.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[60%]">{r.description || r.category}</span>
                      <span className="text-foreground">¥{Number(r.amount_cny).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashboardCard>

          <DashboardCard title="今日热量" icon={Flame} onClick={() => navigate("/calories")} className="md:col-span-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{todayCalories} / {calorieTarget} kcal</span>
                <span className="text-muted-foreground">{Math.round((todayCalories / calorieTarget) * 100)}%</span>
              </div>
              <Progress value={Math.min(100, (todayCalories / calorieTarget) * 100)} className="h-2" />
              {Object.keys(calorieBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {Object.entries(calorieBreakdown).map(([meal, cals]) => (
                    <Badge key={meal} variant="outline" className="text-[10px] px-1.5 py-0">
                      {meal} {Number(cals).toFixed(0)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </DashboardCard>

          <DashboardCard title="16+8 断食" icon={Timer} onClick={() => navigate("/weight-loss")} className="md:col-span-4">
            <div className="space-y-1">
              <p className={`text-lg font-semibold ${isEatingWindow ? "text-success" : "text-destructive"}`}>
                {isEatingWindow ? "🟢 进食窗口" : "🔴 断食中"}
              </p>
              <p className="text-xs text-muted-foreground">
                进食: {String(Math.floor(eatingStartMin / 60)).padStart(2, "0")}:{String(eatingStartMin % 60).padStart(2, "0")} - {String(Math.floor(eatingEndMin / 60) % 24).padStart(2, "0")}:{String(eatingEndMin % 60).padStart(2, "0")}
              </p>
            </div>
          </DashboardCard>

          <DashboardCard title="项目管理" icon={Kanban} onClick={() => navigate("/projects")} className="md:col-span-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{activeProjects.length} 个活跃项目</span>
                <span className="text-muted-foreground">{avgProgress}%</span>
              </div>
              <Progress value={avgProgress} className="h-2" />
            </div>
          </DashboardCard>

          <DashboardCard title="本周目标" icon={Target} onClick={() => navigate("/goals")} className="md:col-span-4">
            {weekGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无本周目标</p>
            ) : (
              <div className="space-y-1">
                {weekGoals.slice(0, 3).map((g: any) => (
                  <p key={g.id} className={`text-xs ${g.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {g.is_completed ? "✓ " : "○ "}{g.title}
                  </p>
                ))}
                {weekGoals.length > 3 && <p className="text-[10px] text-muted-foreground">+{weekGoals.length - 3} 个目标</p>}
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="体重趋势" icon={TrendingDown} onClick={() => navigate("/weight-loss")} className="md:col-span-4">
            {weightTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无记录</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-semibold">{Number(weightTrend[weightTrend.length - 1]?.weight).toFixed(1)} kg</p>
                  {weightTrend.length >= 2 && (() => {
                    const diff = Number(weightTrend[weightTrend.length - 1]?.weight) - Number(weightTrend[0]?.weight);
                    return <p className={`text-xs ${diff <= 0 ? "text-success" : "text-destructive"}`}>
                      近{weightTrend.length}次 {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                    </p>;
                  })()}
                </div>
                {weightTrend.length >= 2 && (
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightTrend.map((w: any) => ({ date: w.date, weight: Number(w.weight) }))}>
                        <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="食材库存" icon={Carrot} onClick={() => navigate("/pantry")} className="md:col-span-3">
            {expiringPantry.length === 0 ? (
              <p className="text-sm text-muted-foreground">无即将过期食材</p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">即将过期</p>
                {expiringPantry.slice(0, 3).map((item: any) => {
                  const daysLeft = item.expiry_date
                    ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-sm text-foreground truncate max-w-[70%]">{item.name}</span>
                      <span className={`text-xs ${daysLeft !== null && daysLeft <= 1 ? "text-destructive" : "text-warning"}`}>
                        {daysLeft !== null ? `${daysLeft} 天` : "未知"}
                      </span>
                    </div>
                  );
                })}
                {expiringPantry.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{expiringPantry.length - 3} 个食材</p>
                )}
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="超值用品" icon={Package} onClick={() => navigate("/belongings")} className="md:col-span-3">
            {overdueDurables.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无超值用品</p>
            ) : (
              <div className="space-y-1">
                {overdueDurables.slice(0, 2).map((item: any) => {
                  const daysUsed = Math.floor((Date.now() - new Date(item.purchase_date).getTime()) / 86400000);
                  const saved = (item.purchase_price / item.expected_lifespan_days) * (daysUsed - item.expected_lifespan_days);
                  return <p key={item.id} className="text-xs text-success">✅ {item.name} 已省 ¥{saved.toFixed(0)}</p>;
                })}
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="最近随想" icon={Lightbulb} onClick={() => navigate("/thoughts")} className="md:col-span-6">
            {recentThoughts.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无随想</p>
            ) : (
              <div className="space-y-2">
                {recentThoughts.map((t: any) => (
                  <div key={t.id}>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.icon} {t.title || t.content.slice(0, 40)}
                    </p>
                    {t.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {t.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </AppLayout>
  );
}
