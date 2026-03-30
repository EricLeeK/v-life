import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Flame, Wallet, CheckSquare, Carrot, Package, Lightbulb } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

function DashboardCard({ 
  title, icon: Icon, children, onClick, className = "" 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card 
      className={`cursor-pointer hover:border-primary/30 transition-colors ${className}`}
      onClick={onClick}
    >
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

  return (
    <AppLayout title="首页概览">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
        <DashboardCard title="今日日程" icon={CalendarDays} onClick={() => navigate("/schedule")}>
          <p className="text-2xl font-semibold text-foreground">0</p>
          <p className="text-xs text-muted-foreground mt-1">暂无安排</p>
        </DashboardCard>

        <DashboardCard title="今日热量" icon={Flame} onClick={() => navigate("/calories")}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">0 / 2000 kcal</span>
              <span className="text-muted-foreground">0%</span>
            </div>
            <Progress value={0} className="h-2" />
          </div>
        </DashboardCard>

        <DashboardCard title="本月支出" icon={Wallet} onClick={() => navigate("/finance")}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground font-medium">¥0.00</span>
              <span className="text-muted-foreground">/ ¥5,000</span>
            </div>
            <Progress value={0} className="h-2" />
          </div>
        </DashboardCard>

        <DashboardCard title="待办事项" icon={CheckSquare} onClick={() => navigate("/todos")}>
          <p className="text-2xl font-semibold text-foreground">0</p>
          <p className="text-xs text-muted-foreground mt-1">全部已完成</p>
        </DashboardCard>

        <DashboardCard title="食材库存" icon={Carrot} onClick={() => navigate("/pantry")}>
          <div className="flex justify-between">
            <div>
              <p className="text-2xl font-semibold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">库存品类</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-warning">0</p>
              <p className="text-xs text-muted-foreground mt-1">即将过期</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="超值用品" icon={Package} onClick={() => navigate("/belongings")}>
          <p className="text-sm text-muted-foreground">暂无超值用品</p>
        </DashboardCard>

        <DashboardCard title="最近随想" icon={Lightbulb} onClick={() => navigate("/thoughts")} className="md:col-span-2 lg:col-span-1">
          <p className="text-sm text-muted-foreground">暂无随想</p>
        </DashboardCard>
      </div>
    </AppLayout>
  );
}
