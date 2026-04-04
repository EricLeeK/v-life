import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Flame, Wallet, CheckSquare, Carrot, Package, Lightbulb, Target, TrendingDown, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useTodaySchedule, useTodayCalorieSummary, useMonthFinanceSummary,
  usePendingTodos, useExpiringPantry, useOverdueDurables, useRecentThoughts, useSettings,
  useCurrentWeekGoals, useRecentWeightTrend
} from "@/hooks/useData";
import { format } from "date-fns";

function DashboardCard({ title, icon: Icon, children, onClick }: { title: string; icon: React.ElementType; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={onClick}>
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
  const { data: financeSummary } = useMonthFinanceSummary(now.getFullYear(), now.getMonth() + 1);
  const { data: pendingTodos = [] } = usePendingTodos();
  const { data: expiringPantry = [] } = useExpiringPantry();
  const { data: overdueDurables = [] } = useOverdueDurables();
  const { data: recentThoughts = [] } = useRecentThoughts();
  const { data: weekGoals = [] } = useCurrentWeekGoals();
  const { data: weightTrend = [] } = useRecentWeightTrend();

  const calorieTarget = settings?.calorie_target || 2000;
  const budget = settings?.monthly_budget || 5000;
  const totalSpending = financeSummary?.total || 0;
  const urgentTodos = pendingTodos.filter((t: any) => t.importance === "紧急");

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
        <DashboardCard title="今日日程" icon={CalendarDays} onClick={() => navigate("/schedule")}>
          <p className="text-2xl font-semibold">{todayEvents.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {nextEvent ? `下一个: ${(nextEvent as any).title} ${format(new Date((nextEvent as any).start_time), "HH:mm")}` : "暂无安排"}
          </p>
        </DashboardCard>

        <DashboardCard title="今日热量" icon={Flame} onClick={() => navigate("/calories")}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{todayCalories} / {calorieTarget} kcal</span>
              <span className="text-muted-foreground">{Math.round((todayCalories / calorieTarget) * 100)}%</span>
            </div>
            <Progress value={Math.min(100, (todayCalories / calorieTarget) * 100)} className="h-2" />
          </div>
        </DashboardCard>

        <DashboardCard title="本月支出" icon={Wallet} onClick={() => navigate("/finance")}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">¥{totalSpending.toFixed(2)}</span>
              <span className="text-muted-foreground">/ ¥{budget.toLocaleString()}</span>
            </div>
            <Progress value={Math.min(100, (totalSpending / budget) * 100)} className="h-2" />
          </div>
        </DashboardCard>

        <DashboardCard title="待办事项" icon={CheckSquare} onClick={() => navigate("/todos")}>
          <p className="text-2xl font-semibold">{pendingTodos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {urgentTodos.length > 0 ? <span className="text-destructive">{urgentTodos.length} 个紧急</span> : "无紧急事项"}
          </p>
        </DashboardCard>

        <DashboardCard title="本周目标" icon={Target} onClick={() => navigate("/goals")}>
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

        <DashboardCard title="体重趋势" icon={TrendingDown} onClick={() => navigate("/weight-loss")}>
          {weightTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无记录</p>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl font-semibold">{Number(weightTrend[weightTrend.length - 1]?.weight).toFixed(1)} kg</p>
              {weightTrend.length >= 2 && (() => {
                const diff = Number(weightTrend[weightTrend.length - 1]?.weight) - Number(weightTrend[0]?.weight);
                return <p className={`text-xs ${diff <= 0 ? "text-success" : "text-destructive"}`}>
                  近{weightTrend.length}次 {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                </p>;
              })()}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="16+8 断食" icon={Timer} onClick={() => navigate("/weight-loss")}>
          <div className="space-y-1">
            <p className={`text-lg font-semibold ${isEatingWindow ? "text-success" : "text-destructive"}`}>
              {isEatingWindow ? "🟢 进食窗口" : "🔴 断食中"}
            </p>
            <p className="text-xs text-muted-foreground">
              进食: {String(fastingStartHour).padStart(2, "0")}:00 - {String(fastingEndHour).padStart(2, "0")}:00
            </p>
          </div>
        </DashboardCard>

        <DashboardCard title="食材库存" icon={Carrot} onClick={() => navigate("/pantry")}>
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground">即将过期</p>
              <p className="text-2xl font-semibold text-warning">{expiringPantry.length}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="超值用品" icon={Package} onClick={() => navigate("/belongings")}>
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

        <DashboardCard title="最近随想" icon={Lightbulb} onClick={() => navigate("/thoughts")}>
          {recentThoughts.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无随想</p>
          ) : (
            <div className="space-y-1">
              {recentThoughts.map((t: any) => (
                <p key={t.id} className="text-xs text-muted-foreground truncate">{t.icon} {t.title || t.content.slice(0, 40)}</p>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>
    </AppLayout>
  );
}
