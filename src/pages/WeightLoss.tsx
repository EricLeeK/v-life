import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSettings, useUpdateSettings, useCaloriesByDate } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";

// ========== Hooks ==========
function useWeightRecords(days = 90) {
  const since = subDays(new Date(), days).toISOString().split("T")[0];
  return useQuery({
    queryKey: ["weight_records", days],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("weight_records")
        .select("*").gte("date", since).order("date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

function useMeasurementRecords(days = 90) {
  const since = subDays(new Date(), days).toISOString().split("T")[0];
  return useQuery({
    queryKey: ["measurement_records", days],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("measurement_records")
        .select("*").gte("date", since).order("date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

// ========== Fasting Timer ==========
function FastingTimer({ startHour }: { startHour: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const eatingStart = startHour;
  const eatingEnd = (startHour + 8) % 24;
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  let isEating: boolean;
  let minutesUntilSwitch: number;

  if (eatingEnd > eatingStart) {
    isEating = currentTotalMinutes >= eatingStart * 60 && currentTotalMinutes < eatingEnd * 60;
    if (isEating) {
      minutesUntilSwitch = eatingEnd * 60 - currentTotalMinutes;
    } else if (currentTotalMinutes < eatingStart * 60) {
      minutesUntilSwitch = eatingStart * 60 - currentTotalMinutes;
    } else {
      minutesUntilSwitch = (24 * 60 - currentTotalMinutes) + eatingStart * 60;
    }
  } else {
    isEating = currentTotalMinutes >= eatingStart * 60 || currentTotalMinutes < eatingEnd * 60;
    if (isEating) {
      minutesUntilSwitch = currentTotalMinutes >= eatingStart * 60
        ? (24 * 60 - currentTotalMinutes) + eatingEnd * 60
        : eatingEnd * 60 - currentTotalMinutes;
    } else {
      minutesUntilSwitch = eatingStart * 60 - currentTotalMinutes;
      if (minutesUntilSwitch < 0) minutesUntilSwitch += 24 * 60;
    }
  }

  const hoursLeft = Math.floor(minutesUntilSwitch / 60);
  const minsLeft = minutesUntilSwitch % 60;

  let colorClass: string;
  if (minutesUntilSwitch <= 60) colorClass = "text-yellow-500";
  else if (isEating) colorClass = "text-green-500";
  else colorClass = "text-red-500";

  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const totalPhaseMinutes = isEating ? 8 * 60 : 16 * 60;
  const elapsedMinutes = totalPhaseMinutes - minutesUntilSwitch;
  const progressPercent = Math.max(0, Math.min(100, (elapsedMinutes / totalPhaseMinutes) * 100));

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
          <span>进食: {formatHour(eatingStart)}-{formatHour(eatingEnd)}</span>
          <span>禁食: {formatHour(eatingEnd)}-{formatHour(eatingStart)}</span>
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
  const foodRecords = records.filter((r: any) => r.meal_type !== "exercise");
  const exerciseRecords = records.filter((r: any) => r.meal_type === "exercise");
  const totalIntake = foodRecords.reduce((sum: number, r: any) => sum + r.calories, 0);
  const totalBurned = exerciseRecords.reduce((sum: number, r: any) => sum + r.calories, 0);
  const netCalories = totalIntake - totalBurned;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">今日热量概览</CardTitle></CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

// ========== Weight Tracker ==========
function WeightTracker() {
  const { data: records = [], refetch } = useWeightRecords();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const chartData = records.map((r: any) => ({
    date: format(new Date(r.date), "MM/dd"),
    体重: Number(r.weight),
  }));

  const latestWeight = records.length > 0 ? Number(records[records.length - 1].weight) : null;
  const firstWeight = records.length > 0 ? Number(records[0].weight) : null;
  const diff = latestWeight && firstWeight ? (latestWeight - firstWeight).toFixed(1) : null;

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
          </div>
        )}
        {chartData.length >= 2 && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey="体重" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {records.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...records].reverse().slice(0, 10).map((r: any) => (
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

  const chartData = records.map((r: any) => {
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
                MEASUREMENT_FIELDS.forEach(({ key }) => {
                  if (form[key]) payload[key] = Number(form[key]);
                });
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
        {chartData.length >= 2 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {MEASUREMENT_FIELDS.map(({ label, color }) => (
                <Line key={label} type="monotone" dataKey={label} stroke={color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {records.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...records].reverse().slice(0, 10).map((r: any) => (
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
        <WeightTracker />
        <MeasurementTracker />

        <Card>
          <CardHeader><CardTitle className="text-base">设置</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="shrink-0">可进食开始时间</Label>
              <Input type="number" min={0} max={23} value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">:00</span>
              <Button size="sm" onClick={handleSaveStart}>保存</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              进食时段：{startHour}:00 - {(startHour + 8) % 24}:00 | 时区：{Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
