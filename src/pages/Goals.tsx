import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp, CalendarDays, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, startOfMonth, startOfYear, format, endOfWeek, addWeeks, addMonths, subWeeks, subMonths } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";
import { GoalStats } from "@/components/charts/GoalStats";

function useGoals(type?: string) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["goals", type],
    queryFn: async () => {
      let query = (supabase.from as any)("goals").select("*").order("period_start", { ascending: false });
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    let goals = demoData.goals;
    if (type) goals = goals.filter((g: any) => g.type === type);
    goals = [...goals].sort((a: any, b: any) => b.period_start.localeCompare(a.period_start));
    return { data: goals, isLoading: false, error: null } as any;
  }
  return supa;
}

type GoalType = "week" | "month" | "year";

function generatePeriodOptions(type: GoalType, lang: string): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];

  if (type === "week") {
    for (let i = -4; i <= 4; i++) {
      const d = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
      const end = endOfWeek(d, { weekStartsOn: 1 });
      const value = format(d, "yyyy-MM-dd");
      const label = lang === "zh"
        ? `${format(d, "MM/dd")} - ${format(end, "MM/dd")}${i === 0 ? " (本周)" : ""}`
        : `${format(d, "MM/dd")} - ${format(end, "MM/dd")}${i === 0 ? " (This Week)" : ""}`;
      options.push({ value, label });
    }
  } else if (type === "month") {
    for (let i = -3; i <= 6; i++) {
      const d = addMonths(startOfMonth(now), i);
      const value = format(d, "yyyy-MM-dd");
      const label = lang === "zh"
        ? `${format(d, "yyyy年M月")}${i === 0 ? " (本月)" : ""}`
        : `${format(d, "MMMM yyyy")}${i === 0 ? " (This Month)" : ""}`;
      options.push({ value, label });
    }
  } else {
    for (let i = -1; i <= 2; i++) {
      const y = now.getFullYear() + i;
      const value = `${y}-01-01`;
      const label = lang === "zh"
        ? `${y}年${i === 0 ? " (今年)" : ""}`
        : `${y}${i === 0 ? " (This Year)" : ""}`;
      options.push({ value, label });
    }
  }
  return options;
}

function GoalColumn({ type, label }: { type: GoalType; label: string }) {
  const icon = type === "year" ? <Target className="h-4 w-4 text-[#5b8c44]" /> : <CalendarDays className="h-4 w-4 text-[#5b88b5]" />;
  const { data: allGoals = [] } = useGoals(type);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const { isDemo, addRecord, updateRecord, deleteRecord: demoDeleteRecord } = useDemoMode();
  const [showAll, setShowAll] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const now = new Date();
  const currentPeriodStart = useMemo(() => {
    if (type === "week") return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (type === "month") return format(startOfMonth(now), "yyyy-MM-dd");
    return format(startOfYear(now), "yyyy-MM-dd");
  }, [type]);

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriodStart);
  const periodOptions = useMemo(() => generatePeriodOptions(type, lang), [type, lang]);

  const currentGoals = useMemo(() => allGoals.filter(g => g.period_start === currentPeriodStart), [allGoals, currentPeriodStart]);

  const groupedGoals = useMemo(() => {
    if (!showAll) return null;
    const groups: Record<string, any[]> = {};
    allGoals.forEach(g => {
      const key = g.period_start;
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [showAll, allGoals]);

  const createMutation = useMutation({
    mutationFn: async ({ title, period }: { title: string; period: string }) => {
      if (isDemo) {
        addRecord("goals", { type, period_start: period, title, is_completed: false, user_id: "demo-user" });
        return;
      }
      const { error } = await (supabase.from as any)("goals").insert({ type, period_start: period, title });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); setNewTitle(""); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      if (isDemo) {
        updateRecord("goals", id, { is_completed });
        return;
      }
      const { error } = await (supabase.from as any)("goals").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_completed }) => {
      await qc.cancelQueries({ queryKey: ["goals"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["goals"] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.map((g: any) => g.id === id ? { ...g, is_completed } : g));
        }
      });
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        demoDeleteRecord("goals", id);
        return;
      }
      const { error } = await (supabase.from as any)("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["goals"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["goals"] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.filter((g: any) => g.id !== id));
        }
      });
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const formatPeriod = (dateStr: string) => {
    const d = new Date(dateStr);
    if (type === "week") {
      const end = endOfWeek(d, { weekStartsOn: 1 });
      return `${format(d, "MM/dd")} - ${format(end, "MM/dd")}`;
    }
    if (type === "month") return lang === "zh" ? format(d, "yyyy年M月") : format(d, "MMMM yyyy");
    return lang === "zh" ? format(d, "yyyy年") : format(d, "yyyy");
  };

  const isCurrent = (dateStr: string) => dateStr === currentPeriodStart;

  const renderGoalItem = (goal: any, i: number = 0) => (
    <div key={goal.id} style={{ ['--i' as any]: i }} className="enter-up flex items-center gap-2 group py-1">
      <Checkbox
        checked={goal.is_completed}
        onCheckedChange={(v) => toggleMutation.mutate({ id: goal.id, is_completed: !!v })}
      />
      <span className={`flex-1 text-sm ${goal.is_completed ? "line-through text-muted-foreground" : ""}`}>
        {goal.title}
      </span>
      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
        onClick={() => deleteMutation.mutate(goal.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">{icon}{label}</CardTitle>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
            onClick={() => setShowAll(!showAll)}>
            {showAll ? <><ChevronUp className="h-3 w-3" />{t("当前", "Current")}</> : <><ChevronDown className="h-3 w-3" />{t("全部", "All")}</>}
          </Button>
        </div>
        {!showAll && <p className="text-xs font-semibold text-primary">{formatPeriod(currentPeriodStart)}</p>}
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {!showAll ? (
          <>
            {currentGoals.length === 0 && <p className="text-xs text-muted-foreground">{t("暂无目标", "No goals")}</p>}
            {currentGoals.map(renderGoalItem)}
          </>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {groupedGoals?.map(([period, goals]) => (
              <div key={period}>
                <div className={`text-xs font-medium mb-1 ${isCurrent(period) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {formatPeriod(period)}{isCurrent(period) ? lang === "zh" ? " ← 当前" : " ← Current" : ""}
                </div>
                {goals.map(renderGoalItem)}
              </div>
            ))}
            {groupedGoals?.length === 0 && <p className="text-xs text-muted-foreground">{t("暂无历史目标", "No history")}</p>}
          </div>
        )}

        {/* Add with period selector */}
        <div className="pt-2 space-y-1">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className={opt.value === currentPeriodStart ? "font-bold text-primary" : ""}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("添加目标...", "Add goal...")}
              className="h-7 text-xs" onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate({ title: newTitle.trim(), period: selectedPeriod })} />
            <Button size="icon" className="h-7 w-7 shrink-0" disabled={!newTitle.trim()}
              onClick={() => newTitle.trim() && createMutation.mutate({ title: newTitle.trim(), period: selectedPeriod })}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoalsPage() {
  const { t } = useLang();
  const { data: allGoals = [] } = useGoals();
  return (
    <AppLayout title={t("目标", "Goals")}>
      <div className="space-y-4">
        <GoalStats goals={allGoals as any[]} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GoalColumn type="week" label={t("周目标", "Weekly")} />
          <GoalColumn type="month" label={t("月目标", "Monthly")} />
          <GoalColumn type="year" label={t("年目标", "Yearly")} />
        </div>
      </div>
    </AppLayout>
  );
}
