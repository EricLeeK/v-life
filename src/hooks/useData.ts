import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

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
function useCrudHooks<T extends keyof Tables<never>>(
  table: string,
  queryKey: string,
  defaultOrder: string = "created_at"
) {
  const useList = (filters?: Record<string, any>) => {
    return useQuery({
      queryKey: [queryKey, filters],
      queryFn: async () => {
        let query = supabase.from(table).select("*").order(defaultOrder, { ascending: false });
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              query = query.eq(key, value);
            }
          });
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
    });
  };

  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (item: any) => {
        const { data, error } = await supabase.from(table).insert(item).select().single();
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
        const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
  };

  const useDelete = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
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
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("finance_records")
        .select("*")
        .gte("date", startDate)
        .lt("date", endDate)
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
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString())
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
        .select("calories")
        .eq("date", today);
      if (error) throw error;
      return (data || []).reduce((sum, r) => sum + r.calories, 0);
    },
  });
}
