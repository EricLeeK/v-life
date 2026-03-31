import { useState, useMemo } from "react";
import { Target, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, startOfYear, endOfWeek, format } from "date-fns";

function useCurrentGoals() {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const yearStart = format(startOfYear(now), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["goals", "current", weekStart, monthStart, yearStart],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("goals")
        .select("*")
        .in("period_start", [weekStart, monthStart, yearStart])
        .order("created_at", { ascending: true });
      if (error) throw error;
      const goals = data as any[];
      return {
        week: goals.filter(g => g.type === "week" && g.period_start === weekStart),
        month: goals.filter(g => g.type === "month" && g.period_start === monthStart),
        year: goals.filter(g => g.type === "year" && g.period_start === yearStart),
      };
    },
  });
}

export function GoalsBall() {
  const [open, setOpen] = useState(false);
  const { data } = useCurrentGoals();

  const totalCount = (data?.week?.length || 0) + (data?.month?.length || 0) + (data?.year?.length || 0);

  if (totalCount === 0 && !open) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-6">
      {open && (
        <div className="absolute bottom-12 right-0 w-64 bg-card border border-border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground">当前目标</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          {(["week", "month", "year"] as const).map(type => {
            const goals = data?.[type] || [];
            if (goals.length === 0) return null;
            return (
              <div key={type}>
                <div className="text-[10px] font-medium text-muted-foreground uppercase mb-0.5">
                  {{ week: "📅 周", month: "📆 月", year: "🎯 年" }[type]}
                </div>
                {goals.map((g: any) => (
                  <div key={g.id} className={`text-xs py-0.5 ${g.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {g.is_completed ? "✓ " : "○ "}{g.title}
                  </div>
                ))}
              </div>
            );
          })}
          {totalCount === 0 && <p className="text-xs text-muted-foreground">暂无目标</p>}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <Target className="h-5 w-5" />
      </button>
    </div>
  );
}
