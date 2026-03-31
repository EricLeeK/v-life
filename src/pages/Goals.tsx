import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, startOfMonth, startOfYear, format, endOfWeek, endOfMonth, endOfYear } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

function useGoals(type?: string) {
  return useQuery({
    queryKey: ["goals", type],
    queryFn: async () => {
      let query = (supabase.from as any)("goals").select("*").order("period_start", { ascending: false });
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

type GoalType = "week" | "month" | "year";

function GoalColumn({ type, label }: { type: GoalType; label: string }) {
  const { data: allGoals = [] } = useGoals(type);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const now = new Date();
  const currentPeriodStart = useMemo(() => {
    if (type === "week") return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (type === "month") return format(startOfMonth(now), "yyyy-MM-dd");
    return format(startOfYear(now), "yyyy-MM-dd");
  }, [type]);

  const currentGoals = useMemo(() => allGoals.filter(g => g.period_start === currentPeriodStart), [allGoals, currentPeriodStart]);

  const groupedGoals = useMemo(() => {
    if (!showAll) return null;
    const groups: Record<string, any[]> = {};
    allGoals.forEach(g => {
      const key = g.period_start;
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [showAll, allGoals]);

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await (supabase.from as any)("goals").insert({ type, period_start: currentPeriodStart, title });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); setNewTitle(""); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await (supabase.from as any)("goals").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const formatPeriod = (dateStr: string) => {
    const d = new Date(dateStr);
    if (type === "week") {
      const end = endOfWeek(d, { weekStartsOn: 1 });
      return `${format(d, "MM/dd")} - ${format(end, "MM/dd")}`;
    }
    if (type === "month") return format(d, "yyyy年M月");
    return format(d, "yyyy年");
  };

  const renderGoalItem = (goal: any) => (
    <div key={goal.id} className="flex items-center gap-2 group py-1">
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
          <CardTitle className="text-sm">{label}</CardTitle>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
            onClick={() => setShowAll(!showAll)}>
            {showAll ? <><ChevronUp className="h-3 w-3" />当前</> : <><ChevronDown className="h-3 w-3" />全部</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{formatPeriod(currentPeriodStart)}</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {!showAll ? (
          <>
            {currentGoals.length === 0 && <p className="text-xs text-muted-foreground">暂无目标</p>}
            {currentGoals.map(renderGoalItem)}
          </>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {groupedGoals?.map(([period, goals]) => (
              <div key={period}>
                <div className="text-xs font-medium text-muted-foreground mb-1">{formatPeriod(period)}</div>
                {goals.map(renderGoalItem)}
              </div>
            ))}
            {groupedGoals?.length === 0 && <p className="text-xs text-muted-foreground">暂无历史目标</p>}
          </div>
        )}

        <div className="flex gap-1 pt-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="添加目标..."
            className="h-7 text-xs" onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate(newTitle.trim())} />
          <Button size="icon" className="h-7 w-7 shrink-0" disabled={!newTitle.trim()}
            onClick={() => newTitle.trim() && createMutation.mutate(newTitle.trim())}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoalsPage() {
  return (
    <AppLayout title="目标">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GoalColumn type="week" label="📅 周目标" />
        <GoalColumn type="month" label="📆 月目标" />
        <GoalColumn type="year" label="🎯 年目标" />
      </div>
    </AppLayout>
  );
}
