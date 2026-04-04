import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, useUpdateSettings, useCaloriesByDate } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subDays, subMonths, subYears } from "date-fns";
import { zhCN } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { useToast } from "@/hooks/use-toast";

// ========== Hooks ==========
function useWeightRecords() {
  return useQuery({
    queryKey: ["weight_records"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("weight_records")
        .select("*").order("date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

function useMeasurementRecords() {
  return useQuery({
    queryKey: ["measurement_records"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("measurement_records")
        .select("*").order("date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

type TimeRange = "week" | "month" | "year";

function filterByRange(records: any[], range: TimeRange): any[] {
  if (records.length === 0) return [];
  const now = new Date();
  let cutoff: Date;
  switch (range) {
    case "week": cutoff = subDays(now, 7); break;
    case "month": cutoff = subMonths(now, 1); break;
    case "year": cutoff = subYears(now, 1); break;
  }
  // Always include from first record date if it's before cutoff
  const firstDate = new Date(records[0].date);
  if (firstDate < cutoff) cutoff = firstDate;
  return records.filter(r => new Date(r.date) >= cutoff);
}

// ========== Fasting Timer ==========
function FastingTimer({ startHour, startMinute = 0 }: { startHour: number; startMinute?: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const eatingStartMin = startHour * 60 + startMinute;
  const eatingEndMin = (eatingStartMin + 8 * 60) % (24 * 60);
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  let isEating: boolean;
  let minutesUntilSwitch: number;

  if (eatingEndMin > eatingStartMin) {
    isEating = currentTotalMinutes >= eatingStartMin && currentTotalMinutes < eatingEndMin;
    if (isEating) minutesUntilSwitch = eatingEndMin - currentTotalMinutes;
    else if (currentTotalMinutes < eatingStartMin) minutesUntilSwitch = eatingStartMin - currentTotalMinutes;
    else minutesUntilSwitch = (24 * 60 - currentTotalMinutes) + eatingStartMin;
  } else {
    isEating = currentTotalMinutes >= eatingStartMin || currentTotalMinutes < eatingEndMin;
    if (isEating) {
      minutesUntilSwitch = currentTotalMinutes >= eatingStartMin
        ? (24 * 60 - currentTotalMinutes) + eatingEndMin
        : eatingEndMin - currentTotalMinutes;
    } else {
      minutesUntilSwitch = eatingStartMin - currentTotalMinutes;
      if (minutesUntilSwitch < 0) minutesUntilSwitch += 24 * 60;
    }
  }

  const hoursLeft = Math.floor(minutesUntilSwitch / 60);
  const minsLeft = minutesUntilSwitch % 60;
  let colorClass = minutesUntilSwitch <= 60 ? "text-yellow-500" : isEating ? "text-green-500" : "text-red-500";
  const formatTime = (totalMin: number) => `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  const totalPhaseMinutes = isEating ? 8 * 60 : 16 * 60;
  const progressPercent = Math.max(0, Math.min(100, ((totalPhaseMinutes - minutesUntilSwitch) / totalPhaseMinutes) * 100));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">16+8 轻断食</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <div className={`text-3xl font-bold ${colorClass}`}>{isEating ? "🍽️ 可进食" : "⏳ 禁食中"}</div>
          <div className={`text-lg font-mono ${colorClass}`}>
            距离{isEating ? "禁食" : "可进食"}还有 {hoursLeft}小时 {minsLeft}分钟
          </div>
        </div>
        <Progress value={progressPercent} className="h-3" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>进食: {formatTime(eatingStartMin)}-{formatTime(eatingEndMin)}</span>
          <span>禁食: {formatTime(eatingEndMin)}-{formatTime(eatingStartMin)}</span>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground justify-center">
          <span className="text-green-500">● 可进食</span>
          <span className="text-yellow-500">● 即将切换</span>
          <span className="text-red-500">● 禁食中</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== Today Calorie Summary ==========
function TodayCalorieSummary() {
  const today = new Date().toISOString().split("T")[0];
  const { data: records = [] } = useCaloriesByDate(today);
  const totalIntake = records.filter((r: any) => r.meal_type !== "exercise").reduce((sum: number, r: any) => sum + r.calories, 0);
  const totalBurned = records.filter((r: any) => r.meal_type === "exercise").reduce((sum: number, r: any) => sum + r.calories, 0);
  const netCalories = totalIntake - totalBurned;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">今日热量概览</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><div className="text-2xl font-bold text-foreground">{totalIntake}</div><div className="text-xs text-muted-foreground">摄入 kcal</div></div>
          <div><div className="text-2xl font-bold text-orange-500">{totalBurned}</div><div className="text-xs text-muted-foreground">消耗 kcal</div></div>
          <div><div className={`text-2xl font-bold ${netCalories > 2000 ? "text-red-500" : "text-green-500"}`}>{netCalories}</div><div className="text-xs text-muted-foreground">净摄入 kcal</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== Weight Tracker ==========
function WeightTracker({ targetWeight }: { targetWeight: number | null }) {
  const { data: records = [] } = useWeightRecords();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [showTarget, setShowTarget] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], weight: "", notes: "" });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase.from as any)("weight_records")
        .upsert(payload, { onConflict: "user_id,date" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weight_records"] }); setDialogOpen(false); toast({ title: "已记录" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("weight_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight_records"] }),
  });

  const filteredRecords = useMemo(() => filterByRange(records, timeRange), [records, timeRange]);

  const chartData = filteredRecords.map((r: any) => ({
    date: format(new Date(r.date), "MM/dd"),
    体重: Number(r.weight),
    ...(targetWeight && showTarget ? { 目标: targetWeight } : {}),
  }));

  const latestWeight = records.length > 0 ? Number(records[records.length - 1].weight) : null;
  const firstWeight = records.length > 0 ? Number(records[0].weight) : null;
  const diff = latestWeight && firstWeight ? (latestWeight - firstWeight).toFixed(1) : null;

  // Calculate Y-axis domain to include target weight when showTarget is on
  const yDomain = useMemo(() => {
    if (!showTarget || !targetWeight || chartData.length === 0) return ["auto", "auto"] as const;
    const weights = filteredRecords.map((r: any) => Number(r.weight));
    const minW = Math.min(...weights, targetWeight);
    const maxW = Math.max(...weights, targetWeight);
    const padding = (maxW - minW) * 0.1 || 1;
    return [Math.floor((minW - padding) * 10) / 10, Math.ceil((maxW + padding) * 10) / 10];
  }, [showTarget, targetWeight, filteredRecords, chartData.length]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">体重记录</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7"><Plus className="h-3 w-3 mr-1" />记录</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>记录体重</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>日期</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>体重 (kg)</Label><Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="如 65.5" /></div>
              <div><Label>备注</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={() => {
                if (!form.weight) return;
                saveMutation.mutate({ date: form.date, weight: Number(form.weight), notes: form.notes || null });
              }}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestWeight && (
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">{latestWeight} kg</span>
            {diff && (
              <span className={`text-sm font-medium ${Number(diff) < 0 ? "text-green-500" : Number(diff) > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {Number(diff) > 0 ? "+" : ""}{diff} kg
              </span>
            )}
            {targetWeight && (
              <span className="text-xs text-muted-foreground">目标: {targetWeight} kg</span>
            )}
          </div>
        )}

        {targetWeight && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={showTarget} onCheckedChange={(v) => setShowTarget(!!v)} />
            <span className="text-muted-foreground">显示目标线</span>
          </label>
        )}

        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">周</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="year">年</TabsTrigger>
          </TabsList>
        </Tabs>

        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis domain={yDomain as any} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey="体重" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
              {targetWeight && showTarget && (
                <ReferenceLine y={targetWeight} stroke="#10b981" strokeDasharray="5 5" label={{ value: `目标 ${targetWeight}kg`, fontSize: 11, fill: "#10b981" }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">需要至少2条记录才能显示曲线图</p>
        )}

        {records.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...records].reverse().slice(0, 20).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">{format(new Date(r.date), "MM/dd EEE", { locale: zhCN })}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.weight} kg</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {records.length === 0 && <p className="text-xs text-muted-foreground">暂无记录，点击右上角添加</p>}
      </CardContent>
    </Card>
  );
}

// ========== Measurement Tracker ==========
const MEASUREMENT_FIELDS = [
  { key: "waist", label: "腰围", color: "#f97316" },
  { key: "hip", label: "臀围", color: "#8b5cf6" },
  { key: "chest", label: "胸围", color: "#06b6d4" },
  { key: "arm", label: "臂围", color: "#10b981" },
  { key: "thigh", label: "大腿围", color: "#ec4899" },
] as const;

function MeasurementTracker() {
  const { data: records = [] } = useMeasurementRecords();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [form, setForm] = useState<Record<string, string>>({ date: new Date().toISOString().split("T")[0] });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase.from as any)("measurement_records")
        .upsert(payload, { onConflict: "user_id,date" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["measurement_records"] }); setDialogOpen(false); toast({ title: "已记录" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("measurement_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement_records"] }),
  });

  const filteredRecords = useMemo(() => filterByRange(records, timeRange), [records, timeRange]);

  const chartData = filteredRecords.map((r: any) => {
    const point: any = { date: format(new Date(r.date), "MM/dd") };
    MEASUREMENT_FIELDS.forEach(({ key, label }) => {
      if (r[key] != null) point[label] = Number(r[key]);
    });
    return point;
  });

  const latest = records.length > 0 ? records[records.length - 1] : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">围度记录</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7"><Plus className="h-3 w-3 mr-1" />记录</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>记录围度 (cm)</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>日期</Label><Input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              {MEASUREMENT_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <Label>{label} (cm)</Label>
                  <Input type="number" step="0.1" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <Button className="w-full" onClick={() => {
                const payload: any = { date: form.date };
                MEASUREMENT_FIELDS.forEach(({ key }) => { if (form[key]) payload[key] = Number(form[key]); });
                saveMutation.mutate(payload);
              }}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest && (
          <div className="grid grid-cols-5 gap-2 text-center">
            {MEASUREMENT_FIELDS.map(({ key, label, color }) => (
              <div key={key}>
                <div className="text-lg font-bold" style={{ color }}>{latest[key] != null ? `${latest[key]}` : "-"}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        )}

        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">周</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="year">年</TabsTrigger>
          </TabsList>
        </Tabs>

        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {MEASUREMENT_FIELDS.map(({ label, color }) => (
                <Line key={label} type="monotone" dataKey={label} stroke={color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">需要至少2条记录才能显示曲线图</p>
        )}

        {records.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...records].reverse().slice(0, 20).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">{format(new Date(r.date), "MM/dd EEE", { locale: zhCN })}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    {MEASUREMENT_FIELDS.filter(({ key }) => r[key] != null).map(({ key, label }) => `${label}${r[key]}`).join(" / ")}
                  </span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {records.length === 0 && <p className="text-xs text-muted-foreground">暂无记录，点击右上角添加</p>}
      </CardContent>
    </Card>
  );
}

// ========== Main Page ==========
export default function WeightLossPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const [editStart, setEditStart] = useState<string>("");
  const [editStartMin, setEditStartMin] = useState<string>("0");
  const [editTarget, setEditTarget] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setEditStart(String((settings as any).fasting_start_hour ?? 12));
      setEditStartMin(String((settings as any).fasting_start_minute ?? 0));
      setEditTarget(String((settings as any).target_weight ?? ""));
    }
  }, [settings]);

  if (isLoading || !settings) return <AppLayout title="减肥专项"><p className="text-sm text-muted-foreground">加载中...</p></AppLayout>;

  const startHour = (settings as any).fasting_start_hour ?? 12;
  const startMinute = (settings as any).fasting_start_minute ?? 0;
  const targetWeight = (settings as any).target_weight ? Number((settings as any).target_weight) : null;

  const handleSaveSettings = async () => {
    const h = parseInt(editStart);
    const m = parseInt(editStartMin) || 0;
    if (isNaN(h) || h < 0 || h > 23) return;
    if (m < 0 || m > 59) return;
    const tw = editTarget ? Number(editTarget) : null;
    await updateSettings.mutateAsync({ fasting_start_hour: h, fasting_start_minute: m, target_weight: tw } as any);
    toast({ title: "设置已保存" });
  };

  return (
    <AppLayout title="减肥专项">
      <div className="max-w-2xl space-y-4">
        <FastingTimer startHour={startHour} startMinute={startMinute} />
        <TodayCalorieSummary />
        <WeightTracker targetWeight={targetWeight} />
        <MeasurementTracker />

        <Card>
          <CardHeader><CardTitle className="text-base">设置</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">进食开始</Label>
              <Input type="number" min={0} max={23} value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">时</span>
              <Input type="number" min={0} max={59} step={5} value={editStartMin} onChange={(e) => setEditStartMin(e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">分</span>
            </div>
            <div className="flex items-center gap-3">
              <Label className="shrink-0">目标体重</Label>
              <Input type="number" step="0.1" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="w-24" placeholder="kg" />
              <span className="text-sm text-muted-foreground">kg</span>
            </div>
            <Button size="sm" onClick={handleSaveSettings}>保存设置</Button>
            <p className="text-xs text-muted-foreground">
              进食时段：{startHour}:{String(startMinute).padStart(2, "0")} - {Math.floor(((startHour * 60 + startMinute) + 8 * 60) / 60) % 24}:{String(((startHour * 60 + startMinute) + 8 * 60) % 60).padStart(2, "0")} | 时区：{Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
