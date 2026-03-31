import { useState } from "react";
import { Target, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, startOfYear, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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
  const { data } = useCurrentGoals();
  const totalCount = (data?.week?.length || 0) + (data?.month?.length || 0) + (data?.year?.length || 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full relative">
          <Target className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-2">
          <span className="text-xs font-semibold text-foreground">当前目标</span>
          {(["week", "month", "year"] as const).map(type => {
            const goals = data?.[type] || [];
            if (goals.length === 0) return null;
            return (
              <div key={type}>
                <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
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
      </PopoverContent>
    </Popover>
  );
}
