import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { useDemoMode } from "@/contexts/DemoModeContext";
import type { DemoDataStore } from "@/data/demoSeed";

// ============ Demo-mode helpers ============
function useDemoQuery<T>(key: string, filter: (data: DemoDataStore) => T): { data: T | undefined; isLoading: false; error: null } {
  const { demoData } = useDemoMode();
  return { data: filter(demoData), isLoading: false, error: null };
}

function useDemoMutation<TArgs>(table: keyof DemoDataStore, operation: "create" | "update" | "delete") {
  const { addRecord, updateRecord, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  return {
    mutate: (args: TArgs) => {
      if (operation === "create") {
        addRecord(table, args as any);
      } else if (operation === "update") {
        const { id, ...updates } = args as any;
        updateRecord(table, id, updates);
      } else {
        deleteRecord(table, args as any);
      }
      qc.invalidateQueries({ queryKey: [table] });
    },
    mutateAsync: async (args: TArgs) => {
      if (operation === "create") {
        return addRecord(table, args as any);
      } else if (operation === "update") {
        const { id, ...updates } = args as any;
        updateRecord(table, id, updates);
        return { id, ...updates };
      } else {
        deleteRecord(table, args as any);
        return undefined;
      }
    },
    isPending: false,
  };
}

// ============ Settings ============
export function useSettings() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).single();
      if (error) {
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
    enabled: !isDemo,
  });
  if (isDemo) return { data: demoData.settings, isLoading: false, error: null } as any;
  return supa;
}

export function useUpdateSettings() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
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
  if (isDemo) {
    return {
      mutate: (updates: any) => {
        updateRecord("settings", "demo-10000000-0000-0000-0000-000000000001", updates);
        qc.invalidateQueries({ queryKey: ["settings"] });
      },
      mutateAsync: async (updates: any) => {
        updateRecord("settings", "demo-10000000-0000-0000-0000-000000000001", updates);
        qc.invalidateQueries({ queryKey: ["settings"] });
        return updates;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

// ============ Generic CRUD hooks ============
function useCrudHooks(table: string, queryKey: string, defaultOrder: string = "created_at") {
  const useList = (filters?: Record<string, any>) => {
    const { isDemo, demoData } = useDemoMode();
    const supa = useQuery({
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
      enabled: !isDemo,
    });
    if (isDemo) {
      let items = (demoData as any)[table] as any[] || [];
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            items = items.filter((item: any) => item[key] === value);
          }
        });
      }
      items = [...items].sort((a: any, b: any) => (b[defaultOrder] || "").localeCompare(a[defaultOrder] || ""));
      return { data: items, isLoading: false, error: null } as any;
    }
    return supa;
  };

  const useCreate = () => {
    const { isDemo, addRecord } = useDemoMode();
    const qc = useQueryClient();
    const supa = useMutation({
      mutationFn: async (item: any) => {
        const { data, error } = await (supabase.from as any)(table).insert(item).select().single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    });
    if (isDemo) {
      return {
        mutate: (item: any) => { addRecord(table as keyof DemoDataStore, item); qc.invalidateQueries({ queryKey: [queryKey] }); },
        mutateAsync: async (item: any) => { const r = addRecord(table as keyof DemoDataStore, item); qc.invalidateQueries({ queryKey: [queryKey] }); return r; },
        isPending: false,
      } as any;
    }
    return supa;
  };

  const useUpdate = () => {
    const { isDemo, updateRecord } = useDemoMode();
    const qc = useQueryClient();
    const supa = useMutation({
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
    if (isDemo) {
      return {
        mutate: ({ id, ...updates }: any) => { updateRecord(table as keyof DemoDataStore, id, updates); qc.invalidateQueries({ queryKey: [queryKey] }); },
        mutateAsync: async ({ id, ...updates }: any) => { updateRecord(table as keyof DemoDataStore, id, updates); qc.invalidateQueries({ queryKey: [queryKey] }); return { id, ...updates }; },
        isPending: false,
      } as any;
    }
    return supa;
  };

  const useDelete = () => {
    const { isDemo, deleteRecord } = useDemoMode();
    const qc = useQueryClient();
    const supa = useMutation({
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
    if (isDemo) {
      return {
        mutate: (id: string) => { deleteRecord(table as keyof DemoDataStore, id); qc.invalidateQueries({ queryKey: [queryKey] }); },
        mutateAsync: async (id: string) => { deleteRecord(table as keyof DemoDataStore, id); qc.invalidateQueries({ queryKey: [queryKey] }); },
        isPending: false,
      } as any;
    }
    return supa;
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
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["finance", "month", year, month],
    queryFn: async () => {
      const startDate = new Date(year, month - 1, 1);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(year, month, 1);
      endDate.setDate(endDate.getDate() + 7);
      const { data, error } = await supabase
        .from("finance_records")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lt("date", endDate.toISOString().split("T")[0])
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const startDate = new Date(year, month - 1, 1);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(year, month, 1);
    endDate.setDate(endDate.getDate() + 7);
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    const filtered = demoData.finance_records
      .filter((r: any) => r.date >= start && r.date < end)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useCaloriesByDate(date: string) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const filtered = demoData.calorie_records
      .filter((r: any) => r.date === date)
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useTodaySchedule() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const filtered = demoData.schedule_events
      .filter((e: any) => {
        const st = new Date(e.start_time);
        return st >= today && st < tomorrow;
      })
      .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useScheduleByRange(start: Date, end: Date) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const filtered = demoData.schedule_events
      .filter((e: any) => new Date(e.start_time) < end && new Date(e.end_time) > start)
      .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useExpiringPantry() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const cutoff = threeDaysLater.toISOString().split("T")[0];
    const filtered = demoData.pantry_items
      .filter((item: any) => item.expiry_date && item.expiry_date <= cutoff)
      .sort((a: any, b: any) => (a.expiry_date || "").localeCompare(b.expiry_date || ""));
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useOverdueDurables() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const today = new Date();
    const filtered = demoData.belongings_durable.filter((item: any) => {
      const purchaseDate = new Date(item.purchase_date);
      const daysUsed = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysUsed > item.expected_lifespan_days;
    });
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useRecentThoughts() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const sorted = [...demoData.thoughts].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
    return { data: sorted.slice(0, 2), isLoading: false, error: null } as any;
  }
  return supa;
}

export function usePendingTodos() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["todos", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("is_completed", false)
        .eq("is_archived", false);
      if (error) throw error;
      return data;
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const filtered = demoData.todos.filter((t: any) => !t.is_completed && !t.is_archived);
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useMonthFinanceSummary(year: number, month: number) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    const records = demoData.finance_records.filter((r: any) => r.date >= startDate && r.date < endDate);
    const total = records.reduce((sum: number, r: any) => sum + Number(r.amount_cny), 0);
    const byCategory: Record<string, number> = {};
    records.forEach((r: any) => {
      byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount_cny);
    });
    return { data: { total, byCategory, count: records.length }, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useTodayCalorieSummary() {
  const { isDemo, demoData } = useDemoMode();
  const today = new Date().toISOString().split("T")[0];
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const records = demoData.calorie_records.filter((r: any) => r.date === today);
    const total = records.reduce((sum: number, r: any) => {
      return r.meal_type === "exercise" ? sum - r.calories : sum + r.calories;
    }, 0);
    return { data: total, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useTodayCalorieBreakdown() {
  const { isDemo, demoData } = useDemoMode();
  const today = new Date().toISOString().split("T")[0];
  const supa = useQuery({
    queryKey: ["calories", "today_breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calorie_records")
        .select("calories, meal_type")
        .eq("date", today);
      if (error) throw error;
      const breakdown: Record<string, number> = {};
      (data || []).forEach((r) => {
        const key = r.meal_type || "other";
        breakdown[key] = (breakdown[key] || 0) + Number(r.calories);
      });
      return breakdown;
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const records = demoData.calorie_records.filter((r: any) => r.date === today);
    const breakdown: Record<string, number> = {};
    records.forEach((r: any) => {
      const key = r.meal_type || "other";
      breakdown[key] = (breakdown[key] || 0) + Number(r.calories);
    });
    return { data: breakdown, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useRecentWeightTrend() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const sorted = [...demoData.weight_records].sort((a: any, b: any) => b.date.localeCompare(a.date));
    return { data: sorted.slice(0, 7).reverse(), isLoading: false, error: null } as any;
  }
  return supa;
}

// ============ Schedule Series Helpers ============
export function useCreateSeriesWithInstances() {
  const { isDemo, addRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (params: {
      master: any;
      instances: any[];
    }) => {
      const { data: masterData, error: masterError } = await supabase
        .from("schedule_events")
        .insert(params.master)
        .select()
        .single();
      if (masterError) throw masterError;

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
  if (isDemo) {
    return {
      mutate: (params: any) => {
        const master = addRecord("schedule_events", params.master);
        params.instances.forEach((inst: any) => {
          addRecord("schedule_events", { ...inst, parent_event_id: master.id, recurrence: null });
        });
        qc.invalidateQueries({ queryKey: ["schedule"] });
      },
      mutateAsync: async (params: any) => {
        const master = addRecord("schedule_events", params.master);
        params.instances.forEach((inst: any) => {
          addRecord("schedule_events", { ...inst, parent_event_id: master.id, recurrence: null });
        });
        qc.invalidateQueries({ queryKey: ["schedule"] });
        return master;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateSeriesWithInstances() {
  const { isDemo, updateRecord, addRecord, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (params: {
      masterId: string;
      masterUpdates: any;
      instances: any[];
    }) => {
      const { error: updateErr } = await supabase
        .from("schedule_events")
        .update(params.masterUpdates)
        .eq("id", params.masterId);
      if (updateErr) throw updateErr;

      const { error: delErr } = await supabase
        .from("schedule_events")
        .delete()
        .eq("parent_event_id", params.masterId);
      if (delErr) throw delErr;

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
  if (isDemo) {
    return {
      mutate: (params: any) => {
        updateRecord("schedule_events", params.masterId, params.masterUpdates);
        qc.invalidateQueries({ queryKey: ["schedule"] });
      },
      mutateAsync: async (params: any) => {
        updateRecord("schedule_events", params.masterId, params.masterUpdates);
        qc.invalidateQueries({ queryKey: ["schedule"] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteSeries() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (masterId: string) => {
      const { error: instErr } = await supabase
        .from("schedule_events")
        .delete()
        .eq("parent_event_id", masterId);
      if (instErr) throw instErr;
      const { error: masterErr } = await supabase
        .from("schedule_events")
        .delete()
        .eq("id", masterId);
      if (masterErr) throw masterErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });
  if (isDemo) {
    return {
      mutate: (masterId: string) => {
        deleteRecord("schedule_events", masterId);
        qc.invalidateQueries({ queryKey: ["schedule"] });
      },
      mutateAsync: async (masterId: string) => {
        deleteRecord("schedule_events", masterId);
        qc.invalidateQueries({ queryKey: ["schedule"] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useCurrentWeekGoals() {
  const { isDemo, demoData } = useDemoMode();
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const weekStart = monday.toISOString().split("T")[0];
  const supa = useQuery({
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
    enabled: !isDemo,
  });
  if (isDemo) {
    const filtered = demoData.goals.filter((g: any) => g.type === "week" && g.period_start === weekStart);
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

// ============ Project Management Hooks ============

export function useProjects() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const sorted = [...demoData.projects].sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
    return { data: sorted, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useCreateProject() {
  const { isDemo, addRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (item: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await supabase.from("projects").insert({ ...item, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
  if (isDemo) {
    return {
      mutate: (item: any) => { addRecord("projects", { ...item, user_id: "demo-user" }); qc.invalidateQueries({ queryKey: ["projects"] }); },
      mutateAsync: async (item: any) => { const r = addRecord("projects", { ...item, user_id: "demo-user" }); qc.invalidateQueries({ queryKey: ["projects"] }); return r; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateProject() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string;[key: string]: any }) => {
      const { data, error } = await supabase.from("projects").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
  if (isDemo) {
    return {
      mutate: ({ id, ...updates }: any) => { updateRecord("projects", id, updates); qc.invalidateQueries({ queryKey: ["projects"] }); },
      mutateAsync: async ({ id, ...updates }: any) => { updateRecord("projects", id, updates); qc.invalidateQueries({ queryKey: ["projects"] }); return { id, ...updates }; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteProject() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
  if (isDemo) {
    return {
      mutate: (id: string) => { deleteRecord("projects", id); qc.invalidateQueries({ queryKey: ["projects"] }); },
      mutateAsync: async (id: string) => { deleteRecord("projects", id); qc.invalidateQueries({ queryKey: ["projects"] }); },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useProjectTasks(projectId?: string) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
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
    enabled: !!projectId && !isDemo,
  });
  if (isDemo && projectId) {
    const filtered = demoData.project_tasks
      .filter((t: any) => t.project_id === projectId)
      .sort((a: any, b: any) => a.sort_order - b.sort_order);
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useCreateProjectTask() {
  const { isDemo, addRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
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
  if (isDemo) {
    return {
      mutate: (item: any) => { addRecord("project_tasks", item); qc.invalidateQueries({ queryKey: ["project_tasks", item.project_id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
      mutateAsync: async (item: any) => { const r = addRecord("project_tasks", item); qc.invalidateQueries({ queryKey: ["project_tasks", item.project_id] }); qc.invalidateQueries({ queryKey: ["projects"] }); return r; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateProjectTask() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, project_id, ...updates }: { id: string; project_id: string;[key: string]: any }) => {
      const { data, error } = await supabase.from("project_tasks").update(updates as any).eq("id", id).select().single();
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
  if (isDemo) {
    return {
      mutate: ({ id, project_id, ...updates }: any) => { updateRecord("project_tasks", id, updates); qc.invalidateQueries({ queryKey: ["project_tasks", project_id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
      mutateAsync: async ({ id, project_id, ...updates }: any) => { updateRecord("project_tasks", id, updates); qc.invalidateQueries({ queryKey: ["project_tasks", project_id] }); qc.invalidateQueries({ queryKey: ["projects"] }); return { id, ...updates }; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteProjectTask() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
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
  if (isDemo) {
    return {
      mutate: ({ id, project_id }: any) => { deleteRecord("project_tasks", id); qc.invalidateQueries({ queryKey: ["project_tasks", project_id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
      mutateAsync: async ({ id, project_id }: any) => { deleteRecord("project_tasks", id); qc.invalidateQueries({ queryKey: ["project_tasks", project_id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useHabitLogs(taskId?: string) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["habit_logs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("*").eq("task_id", taskId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId && !isDemo,
  });
  if (isDemo && taskId) {
    const filtered = demoData.habit_logs.filter((l: any) => l.task_id === taskId);
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useToggleHabitLog() {
  const { isDemo, addRecord, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
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
  if (isDemo) {
    return {
      mutate: ({ taskId, projectId, logDate }: any) => {
        const existing = (qc.getQueryData<any[]>(["habit_logs", taskId]) || [])
          .find((l: any) => l.task_id === taskId && l.log_date === logDate);
        if (existing) {
          deleteRecord("habit_logs", existing.id);
        } else {
          addRecord("habit_logs", { task_id: taskId, log_date: logDate, completed_at: new Date().toISOString() });
        }
        qc.invalidateQueries({ queryKey: ["habit_logs", taskId] });
        qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
      },
      mutateAsync: async (args: any) => {
        const { taskId, projectId, logDate } = args;
        const existing = (qc.getQueryData<any[]>(["habit_logs", taskId]) || [])
          .find((l: any) => l.task_id === taskId && l.log_date === logDate);
        if (existing) {
          deleteRecord("habit_logs", existing.id);
          qc.invalidateQueries({ queryKey: ["habit_logs", taskId] });
          qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
          return { completed: false };
        } else {
          addRecord("habit_logs", { task_id: taskId, log_date: logDate, completed_at: new Date().toISOString() });
          qc.invalidateQueries({ queryKey: ["habit_logs", taskId] });
          qc.invalidateQueries({ queryKey: ["project_tasks", projectId] });
          return { completed: true };
        }
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useTaskTags(projectId?: string) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["task_tags", projectId],
    queryFn: async () => {
      let query = supabase.from("task_tags").select("*");
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    let tags = demoData.task_tags;
    if (projectId) tags = tags.filter((t: any) => t.project_id === projectId);
    tags = [...tags].sort((a: any, b: any) => a.name.localeCompare(b.name));
    return { data: tags, isLoading: false, error: null } as any;
  }
  return supa;
}
