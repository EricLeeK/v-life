import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings, useCaloriesByDate } from "@/hooks/useData";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

function FastingTimer({ startHour }: { startHour: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 16+8: eating window = startHour to startHour+8
  const eatingStart = startHour;
  const eatingEnd = (startHour + 8) % 24;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  // Determine if currently in eating window
  let isEating: boolean;
  let minutesUntilSwitch: number;

  if (eatingEnd > eatingStart) {
    // Normal range e.g. 12-20
    isEating = currentTotalMinutes >= eatingStart * 60 && currentTotalMinutes < eatingEnd * 60;
    if (isEating) {
      minutesUntilSwitch = eatingEnd * 60 - currentTotalMinutes;
    } else if (currentTotalMinutes < eatingStart * 60) {
      minutesUntilSwitch = eatingStart * 60 - currentTotalMinutes;
    } else {
      minutesUntilSwitch = (24 * 60 - currentTotalMinutes) + eatingStart * 60;
    }
  } else {
    // Wraps midnight e.g. 20-04
    isEating = currentTotalMinutes >= eatingStart * 60 || currentTotalMinutes < eatingEnd * 60;
    if (isEating) {
      if (currentTotalMinutes >= eatingStart * 60) {
        minutesUntilSwitch = (24 * 60 - currentTotalMinutes) + eatingEnd * 60;
      } else {
        minutesUntilSwitch = eatingEnd * 60 - currentTotalMinutes;
      }
    } else {
      minutesUntilSwitch = eatingStart * 60 - currentTotalMinutes;
      if (minutesUntilSwitch < 0) minutesUntilSwitch += 24 * 60;
    }
  }

  const hoursLeft = Math.floor(minutesUntilSwitch / 60);
  const minsLeft = minutesUntilSwitch % 60;

  // Color logic: green=eating, red=fasting, yellow=within 1 hour of switch
  let colorClass: string;
  if (minutesUntilSwitch <= 60) {
    colorClass = "text-yellow-500";
  } else if (isEating) {
    colorClass = "text-green-500";
  } else {
    colorClass = "text-red-500";
  }

  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  // Progress: how much of current phase has elapsed
  const totalPhaseMinutes = isEating ? 8 * 60 : 16 * 60;
  const elapsedMinutes = totalPhaseMinutes - minutesUntilSwitch;
  const progressPercent = Math.max(0, Math.min(100, (elapsedMinutes / totalPhaseMinutes) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">16+8 轻断食</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <div className={`text-3xl font-bold ${colorClass}`}>
            {isEating ? "🍽️ 可进食" : "⏳ 禁食中"}
          </div>
          <div className={`text-lg font-mono ${colorClass}`}>
            距离{isEating ? "禁食" : "可进食"}还有 {hoursLeft}小时 {minsLeft}分钟
          </div>
        </div>

        <Progress value={progressPercent} className="h-3" />

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>可进食时段: {formatHour(eatingStart)} - {formatHour(eatingEnd)}</span>
          <span>禁食时段: {formatHour(eatingEnd)} - {formatHour(eatingStart)}</span>
        </div>

        <div className="flex gap-2 text-xs text-muted-foreground justify-center">
          <span className="text-green-500">● 可进食</span>
          <span className="text-yellow-500">● 即将切换（1小时内）</span>
          <span className="text-red-500">● 禁食中</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TodayCalorieSummary() {
  const today = new Date().toISOString().split("T")[0];
  const { data: records = [] } = useCaloriesByDate(today);

  const foodRecords = records.filter((r: any) => r.meal_type !== "exercise");
  const exerciseRecords = records.filter((r: any) => r.meal_type === "exercise");

  const totalIntake = foodRecords.reduce((sum: number, r: any) => sum + r.calories, 0);
  const totalBurned = exerciseRecords.reduce((sum: number, r: any) => sum + r.calories, 0);
  const netCalories = totalIntake - totalBurned;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">今日热量概览</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">{totalIntake}</div>
            <div className="text-xs text-muted-foreground">摄入 kcal</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-500">{totalBurned}</div>
            <div className="text-xs text-muted-foreground">消耗 kcal</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${netCalories > 2000 ? "text-red-500" : "text-green-500"}`}>{netCalories}</div>
            <div className="text-xs text-muted-foreground">净摄入 kcal</div>
          </div>
        </div>
        {exerciseRecords.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">🏃 今日运动:</p>
            {exerciseRecords.map((r: any) => (
              <div key={r.id} className="text-xs flex justify-between">
                <span>{r.food_name}</span>
                <span className="text-orange-500">-{r.calories} kcal</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WeightLossPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [editStart, setEditStart] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setEditStart(String((settings as any).fasting_start_hour ?? 12));
    }
  }, [settings]);

  if (isLoading || !settings) return <AppLayout title="减肥专项"><p className="text-sm text-muted-foreground">加载中...</p></AppLayout>;

  const startHour = (settings as any).fasting_start_hour ?? 12;

  const handleSaveStart = async () => {
    const h = parseInt(editStart);
    if (isNaN(h) || h < 0 || h > 23) return;
    await updateSettings.mutateAsync({ fasting_start_hour: h } as any);
  };

  return (
    <AppLayout title="减肥专项">
      <div className="max-w-2xl space-y-4">
        <FastingTimer startHour={startHour} />
        <TodayCalorieSummary />

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="shrink-0">可进食开始时间</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">:00</span>
              <Button size="sm" onClick={handleSaveStart}>保存</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              当前设置：每日 {startHour}:00 - {(startHour + 8) % 24}:00 为可进食时段，其余16小时为禁食时段。
            </p>
            <p className="text-xs text-muted-foreground">
              时区跟随设备：{Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
