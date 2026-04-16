import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

// ============ Settings ============
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).single();
      if (error) {
        // If no settings row, create one
        if (error.code === "PGRST116") {
          const { data: newData, error: insertError } = await supabase
            .from("settings")
            .insert({})
            .select()
            .single();
          if (insertError) throw insertError;
          return newData;
        }
        throw error;
      }
      return data;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Tables<"settings">>) => {
      const { data: existing } = await supabase.from("settings").select("id").limit(1).single();
      if (!existing) throw new Error("No settings found");
      const { data, error } = await supabase
        .from("settings")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ============ Generic CRUD hooks ============
function useCrudHooks(table: string, queryKey: string, defaultOrder: string = "created_at") {
  const useList = (filters?: Record<string, any>) => {
    return useQuery({
      queryKey: [queryKey, filters],
      queryFn: async () => {
        let query = (supabase.from as any)(table).select("*").order(defaultOrder, { ascending: false });
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              query = query.eq(key, value);
            }
          });
        }
        const { data, error } = await query;
        if (error) throw error;
        return data as any[];
      },
    });
  };

  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (item: any) => {
        const { data, error } = await (supabase.from as any)(table).insert(item).select().single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  };

  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
        const { data, error } = await (supabase.from as any)(table).update(updates).eq("id", id).select().single();
        if (error) throw error;
        return data;
      },
      onMutate: async ({ id, ...updates }) => {
        await qc.cancelQueries({ queryKey: [queryKey] });
        const queries = qc.getQueriesData<any[]>({ queryKey: [queryKey] });
        const snapshots = queries.map(([key, data]) => [key, data] as const);
        queries.forEach(([key, data]) => {
          if (Array.isArray(data)) {
            qc.setQueryData(key, data.map((item: any) => item.id === id ? { ...item, ...updates } : item));
          }
        });
        return { snapshots };
      },
      onError: (_err, _vars, context) => {
        context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
      },
      onSettled: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  };

  const useDelete = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await (supabase.from as any)(table).delete().eq("id", id);
        if (error) throw error;
      },
      onMutate: async (id) => {
        await qc.cancelQueries({ queryKey: [queryKey] });
        const queries = qc.getQueriesData<any[]>({ queryKey: [queryKey] });
        const snapshots = queries.map(([key, data]) => [key, data] as const);
        queries.forEach(([key, data]) => {
          if (Array.isArray(data)) {
            qc.setQueryData(key, data.filter((item: any) => item.id !== id));
          }
        });
        return { snapshots };
      },
      onError: (_err, _vars, context) => {
        context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
      },
      onSettled: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  };

  return { useList, useCreate, useUpdate, useDelete };
}

export const pantryHooks = useCrudHooks("pantry_items", "pantry");
export const belongingsDailyHooks = useCrudHooks("belongings_daily", "belongings_daily");
export const belongingsDurableHooks = useCrudHooks("belongings_durable", "belongings_durable");
export const scheduleHooks = useCrudHooks("schedule_events", "schedule", "start_time");
export const calorieHooks = useCrudHooks("calorie_records", "calories");
export const financeHooks = useCrudHooks("finance_records", "finance");
export const todoHooks = useCrudHooks("todos", "todos");
export const thoughtHooks = useCrudHooks("thoughts", "thoughts");

// ============ Special queries ============
export function useFinanceByMonth(year: number, month: number) {
  return useQuery({
    queryKey: ["finance", "month", year, month],
    queryFn: async () => {
      // Fetch a wider range to capture weeks that span month boundaries (Wednesday rule)
      const startDate = new Date(year, month - 1, 1);
      startDate.setDate(startDate.getDate() - 7); // 1 week before month start
      const endDate = new Date(year, month, 1);
      endDate.setDate(endDate.getDate() + 7); // 1 week after month end
      const { data, error } = await supabase
        .from("finance_records")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lt("date", endDate.toISOString().split("T")[0])
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCaloriesByDate(date: string) {
  return useQuery({
    queryKey: ["calories", "date", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calorie_records")
        .select("*")
        .eq("date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useTodaySchedule() {
  return useQuery({
    queryKey: ["schedule", "today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useScheduleByRange(start: Date, end: Date) {
  return useQuery({
    queryKey: ["schedule", "range", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useExpiringPantry() {
  return useQuery({
    queryKey: ["pantry", "expiring"],
    queryFn: async () => {
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*")
        .not("expiry_date", "is", null)
        .lte("expiry_date", threeDaysLater.toISOString().split("T")[0])
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useOverdueDurables() {
  return useQuery({
    queryKey: ["belongings_durable", "overdue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("belongings_durable").select("*");
      if (error) throw error;
      const today = new Date();
      return (data || []).filter((item) => {
        const purchaseDate = new Date(item.purchase_date);
        const daysUsed = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysUsed > item.expected_lifespan_days;
      });
    },
  });
}

export function useRecentThoughts() {
  return useQuery({
    queryKey: ["thoughts", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("thoughts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2);
      if (error) throw error;
      return data;
    },
  });
}

export function usePendingTodos() {
  return useQuery({
    queryKey: ["todos", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("is_completed", false);
      if (error) throw error;
      return data;
    },
  });
}

export function useMonthFinanceSummary(year: number, month: number) {
  return useQuery({
    queryKey: ["finance", "summary", year, month],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("finance_records")
        .select("*")
        .gte("date", startDate)
        .lt("date", endDate);
      if (error) throw error;
      const total = (data || []).reduce((sum, r) => sum + Number(r.amount_cny), 0);
      const byCategory: Record<string, number> = {};
      (data || []).forEach((r) => {
        byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount_cny);
      });
      return { total, byCategory, count: data?.length || 0 };
    },
  });
}

export function useTodayCalorieSummary() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["calories", "today_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calorie_records")
        .select("calories, meal_type")
        .eq("date", today);
      if (error) throw error;
      return (data || []).reduce((sum, r) => {
        return r.meal_type === "exercise" ? sum - r.calories : sum + r.calories;
      }, 0);
    },
  });
}

export function useRecentWeightTrend() {
  return useQuery({
    queryKey: ["weight_records", "recent_trend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_records")
        .select("date, weight")
        .order("date", { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data || []).reverse();
    },
  });
}

// ============ Schedule Series Helpers ============
export function useCreateSeriesWithInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      master: any;
      instances: any[];
    }) => {
      // Insert master event
      const { data: masterData, error: masterError } = await supabase
        .from("schedule_events")
        .insert(params.master)
        .select()
        .single();
      if (masterError) throw masterError;

      // Insert instances with parent_event_id
      if (params.instances.length > 0) {
        const rows = params.instances.map((inst) => ({
          ...inst,
          parent_event_id: masterData.id,
          recurrence: null,
        }));
        const { error: instError } = await supabase
          .from("schedule_events")
          .insert(rows);
        if (instError) throw instError;
      }
      return masterData;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
}

export function useUpdateSeriesWithInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      masterId: string;
      masterUpdates: any;
      instances: any[];
    }) => {
      // Update master
      const { error: updateErr } = await supabase
        .from("schedule_events")
        .update(params.masterUpdates)
        .eq("id", params.masterId);
      if (updateErr) throw updateErr;

      // Delete old instances
      const { error: delErr } = await supabase
        .from("schedule_events")
        .delete()
        .eq("parent_event_id", params.masterId);
      if (delErr) throw delErr;

      // Insert new instances
      if (params.instances.length > 0) {
        const rows = params.instances.map((inst) => ({
          ...inst,
          parent_event_id: params.masterId,
          recurrence: null,
        }));
        const { error: instError } = await supabase
          .from("schedule_events")
          .insert(rows);
        if (instError) throw instError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
}

export function useDeleteSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (masterId: string) => {
      // Delete instances first
      const { error: instErr } = await supabase
        .from("schedule_events")
        .delete()
        .eq("parent_event_id", masterId);
      if (instErr) throw instErr;
      // Delete master
      const { error: masterErr } = await supabase
        .from("schedule_events")
        .delete()
        .eq("id", masterId);
      if (masterErr) throw masterErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
}

export function useCurrentWeekGoals() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const weekStart = monday.toISOString().split("T")[0];
  return useQuery({
    queryKey: ["goals", "current_week", weekStart],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("goals")
        .select("*")
        .eq("type", "week")
        .eq("period_start", weekStart)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

// ============ Project Management Hooks ============

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await supabase.from("projects").insert({ ...item, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string;[key: string]: any }) => {
      const { data, error } = await supabase.from("projects").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useProjectTasks(projectId?: string) {
  return useQuery({
    queryKey: ["project_tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from("project_tasks").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["project_tasks", variables.project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...updates }: { id: string; project_id: string } & Record<string, any>) => {
      const { data, error } = await supabase.from("project_tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, project_id, ...updates }) => {
      await qc.cancelQueries({ queryKey: ["project_tasks", project_id] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["project_tasks", project_id] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.map((item: any) => item.id === id ? { ...item, ...updates } : item));
        }
      });
      return { snapshots };
    },
    onError: (_err, { project_id }, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, { project_id }) => {
      qc.invalidateQueries({ queryKey: ["project_tasks", project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from("project_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, project_id }) => {
      await qc.cancelQueries({ queryKey: ["project_tasks", project_id] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["project_tasks", project_id] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.filter((item: any) => item.id !== id));
        }
      });
      return { snapshots };
    },
    onError: (_err, { project_id }, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, { project_id }) => {
      qc.invalidateQueries({ queryKey: ["project_tasks", project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useHabitLogs(taskId?: string) {
  return useQuery({
    queryKey: ["habit_logs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("*").eq("task_id", taskId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId,
  });
}

export function useToggleHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId, logDate }: { taskId: string; projectId: string; logDate: string }) => {
      const { data: existing } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("task_id", taskId)
        .eq("log_date", logDate)
        .single();
      if (existing) {
        const { error } = await supabase.from("habit_logs").delete().eq("id", existing.id);
        if (error) throw error;
        return { completed: false };
      } else {
        const { error } = await supabase.from("habit_logs").insert({ task_id: taskId, log_date: logDate });
        if (error) throw error;
        return { completed: true };
      }
    },
    onSuccess: (_data, { taskId, projectId }) => {
      qc.invalidateQueries({ queryKey: ["habit_logs", taskId] });
      qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
    },
  });
}

export function useTaskTags(projectId?: string) {
  return useQuery({
    queryKey: ["task_tags", projectId],
    queryFn: async () => {
      let query = supabase.from("task_tags").select("*");
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}
