import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { useDemoMode } from "@/contexts/DemoModeContext";
import type { DemoDataStore } from "@/data/demoSeed";
import { pickSettingsRow } from "@/lib/pickSettingsRow";

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
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      const picked = pickSettingsRow(data ?? []);
      if (picked) return picked;
      const { data: newData, error: insertError } = await supabase
        .from("settings")
        .insert({})
        .select()
        .single();
      if (insertError) throw insertError;
      return newData;
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
      const { data: rows, error: loadError } = await supabase.from("settings").select("*");
      if (loadError) throw loadError;
      const existing = pickSettingsRow(rows ?? []);
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

// ============ Learning Notes Hooks ============

export function useLearningCourses() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["learning_courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const sorted = [...demoData.learning_courses].sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
    return { data: sorted, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useCreateLearningCourse() {
  const { isDemo, addRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (item: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await supabase.from("learning_courses").insert({ ...item, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning_courses"] }),
  });
  if (isDemo) {
    return {
      mutate: (item: any) => { addRecord("learning_courses", { ...item, user_id: "demo-user" }); qc.invalidateQueries({ queryKey: ["learning_courses"] }); },
      mutateAsync: async (item: any) => { const r = addRecord("learning_courses", { ...item, user_id: "demo-user" }); qc.invalidateQueries({ queryKey: ["learning_courses"] }); return r; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateLearningCourse() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string;[key: string]: any }) => {
      const { data, error } = await supabase.from("learning_courses").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning_courses"] }),
  });
  if (isDemo) {
    return {
      mutate: ({ id, ...updates }: any) => { updateRecord("learning_courses", id, updates); qc.invalidateQueries({ queryKey: ["learning_courses"] }); },
      mutateAsync: async ({ id, ...updates }: any) => { updateRecord("learning_courses", id, updates); qc.invalidateQueries({ queryKey: ["learning_courses"] }); return { id, ...updates }; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteLearningCourse() {
  const { isDemo, demoData, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["learning_courses"] });
      qc.invalidateQueries({ queryKey: ["learning_notes", id] });
    },
  });
  if (isDemo) {
    return {
      mutate: (id: string) => {
        deleteRecord("learning_courses", id);
        demoData.learning_notes.filter((n: any) => n.course_id === id).forEach((n: any) => deleteRecord("learning_notes", n.id));
        qc.invalidateQueries({ queryKey: ["learning_courses"] });
        qc.invalidateQueries({ queryKey: ["learning_notes", id] });
      },
      mutateAsync: async (id: string) => {
        deleteRecord("learning_courses", id);
        demoData.learning_notes.filter((n: any) => n.course_id === id).forEach((n: any) => deleteRecord("learning_notes", n.id));
        qc.invalidateQueries({ queryKey: ["learning_courses"] });
        qc.invalidateQueries({ queryKey: ["learning_notes", id] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useLearningNotes(courseId?: string) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["learning_notes", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_notes")
        .select("*")
        .eq("course_id", courseId)
        .order("note_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!courseId && !isDemo,
  });
  if (isDemo && courseId) {
    const filtered = demoData.learning_notes
      .filter((n: any) => n.course_id === courseId)
      .sort((a: any, b: any) => ((b.note_date || b.created_at || "")).localeCompare(a.note_date || a.created_at || ""));
    return { data: filtered, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useCreateLearningNote() {
  const { isDemo, addRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from("learning_notes").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // 先同步写入缓存，保证新建后能立刻选中并进入编辑，再后台刷新保持一致
      if (data) {
        qc.setQueryData<any[]>(["learning_notes", variables.course_id], (old) => (old ? [data, ...old] : [data]));
      }
      qc.invalidateQueries({ queryKey: ["learning_notes", variables.course_id] });
    },
  });
  if (isDemo) {
    return {
      mutate: (item: any) => { addRecord("learning_notes", item); qc.invalidateQueries({ queryKey: ["learning_notes", item.course_id] }); },
      mutateAsync: async (item: any) => { const r = addRecord("learning_notes", item); qc.invalidateQueries({ queryKey: ["learning_notes", item.course_id] }); return r; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateLearningNote() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, course_id, ...updates }: { id: string; course_id: string;[key: string]: any }) => {
      const { data, error } = await supabase.from("learning_notes").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, course_id, ...updates }) => {
      await qc.cancelQueries({ queryKey: ["learning_notes", course_id] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["learning_notes", course_id] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.map((item: any) => item.id === id ? { ...item, ...updates } : item));
        }
      });
      return { snapshots };
    },
    onError: (_err, { course_id }, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, { course_id }) => {
      qc.invalidateQueries({ queryKey: ["learning_notes", course_id] });
    },
  });
  if (isDemo) {
    return {
      mutate: ({ id, course_id, ...updates }: any) => { updateRecord("learning_notes", id, updates); qc.invalidateQueries({ queryKey: ["learning_notes", course_id] }); },
      mutateAsync: async ({ id, course_id, ...updates }: any) => { updateRecord("learning_notes", id, updates); qc.invalidateQueries({ queryKey: ["learning_notes", course_id] }); return { id, ...updates }; },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteLearningNote() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id }: { id: string; course_id: string }) => {
      const { error } = await supabase.from("learning_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, course_id }) => {
      await qc.cancelQueries({ queryKey: ["learning_notes", course_id] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["learning_notes", course_id] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.filter((item: any) => item.id !== id));
        }
      });
      return { snapshots };
    },
    onError: (_err, { course_id }, context) => {
      context?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, { course_id }) => {
      qc.invalidateQueries({ queryKey: ["learning_notes", course_id] });
    },
  });
  if (isDemo) {
    return {
      mutate: ({ id, course_id }: any) => { deleteRecord("learning_notes", id); qc.invalidateQueries({ queryKey: ["learning_notes", course_id] }); },
      mutateAsync: async ({ id, course_id }: any) => { deleteRecord("learning_notes", id); qc.invalidateQueries({ queryKey: ["learning_notes", course_id] }); },
      isPending: false,
    } as any;
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

// ============ Today's Todo ============

export const dailyTasksHooks = useCrudHooks("daily_tasks", "daily_tasks", "task_date");
export const userPointsHooks = useCrudHooks("user_points", "user_points");

export function useTodayTasks() {
  const { isDemo, demoData } = useDemoMode();
  const { data: settings } = useSettings();
  const offsetHours = settings?.day_start_hour || 0;
  const today = getLocalDateString(new Date(), offsetHours);
  const supa = useQuery({
    queryKey: ["daily_tasks", "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_tasks")
        .select("*, todos(title, detail, importance, category, is_completed, is_archived, parent_id)")
        .eq("task_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const tasks = demoData.daily_tasks
      .filter((dt: any) => dt.task_date === today)
      .map((dt: any) => {
        const todo = demoData.todos.find((t: any) => t.id === dt.todo_id);
        return { ...dt, todos: todo || null };
      })
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    return { data: tasks, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useUserPoints() {
  const { isDemo, demoData } = useDemoMode();
  const queryClient = useQueryClient();
  const supa = useQuery({
    queryKey: ["user_points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_points")
        .select("*")
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from("user_points")
          .insert({ total_points: 0, current_streak: 0, best_streak: 0 })
          .select()
          .single();
        if (createErr) throw createErr;
        queryClient.invalidateQueries({ queryKey: ["user_points"] });
        return created as any;
      }
      return data as any;
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    return { data: demoData.user_points[0] || null, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useAddToToday() {
  const { isDemo, demoData } = useDemoMode();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { todo_id: string; difficulty: string; base_points: number; metadata?: any }) => {
      const offsetHours = settings?.day_start_hour || 0;
      const todayStr = getLocalDateString(new Date(), offsetHours);

      if (isDemo) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const item = { id, user_id: "demo-user", ...payload, task_date: todayStr, is_completed: false, completed_at: null, created_at: now, updated_at: now, metadata: payload.metadata || {} };
        demoData.daily_tasks.push(item);
        return item;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const insertData = {
        ...payload,
        user_id: user.id,
        task_date: todayStr,
      };

      const { data, error } = await supabase.from("daily_tasks").insert(insertData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["daily_tasks"] }); },
  });
}

export function useCompleteDailyTask() {
  const { isDemo, demoData, updateRecord } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_completed, base_points, metadata }: { id: string; is_completed?: boolean; base_points?: number; metadata?: any }) => {
      if (isDemo) {
        const updates: any = { updated_at: new Date().toISOString() };
        if (is_completed !== undefined) {
          updates.is_completed = is_completed;
          updates.completed_at = is_completed ? new Date().toISOString() : null;
        }
        if (base_points !== undefined) updates.base_points = base_points;
        if (metadata !== undefined) updates.metadata = metadata;
        updateRecord("daily_tasks", id, updates);
        return { id, ...updates };
      }
      const updates: any = {};
      if (is_completed !== undefined) {
        updates.is_completed = is_completed;
        updates.completed_at = is_completed ? new Date().toISOString() : null;
      }
      if (base_points !== undefined) {
        updates.base_points = base_points;
      }
      if (metadata !== undefined) {
        updates.metadata = metadata;
      }
      const { data, error } = await supabase
        .from("daily_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, is_completed, base_points, metadata }) => {
      await queryClient.cancelQueries({ queryKey: ["daily_tasks"] });
      const queries = queryClient.getQueriesData<any[]>({ queryKey: ["daily_tasks"] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      const patch: any = {};
      if (is_completed !== undefined) {
        patch.is_completed = is_completed;
        patch.completed_at = is_completed ? new Date().toISOString() : null;
      }
      if (base_points !== undefined) patch.base_points = base_points;
      if (metadata !== undefined) patch.metadata = metadata;
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData(
            key,
            data.map((item: any) => (item.id === id ? { ...item, ...patch } : item))
          );
        }
      });
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
    },
    // Align with todos: settle in background; do not refetch user_points on every toggle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_tasks"] });
    },
  });
}

export function useRemoveFromToday() {
  const { isDemo, demoData, deleteRecord } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        deleteRecord("daily_tasks", id);
        return id;
      }
      const { error } = await supabase.from("daily_tasks").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["daily_tasks"] });
      const queries = queryClient.getQueriesData<any[]>({ queryKey: ["daily_tasks"] });
      const snapshots = queries.map(([key, data]) => [key, data] as const);
      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData(key, data.filter((item: any) => item.id !== id));
        }
      });
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_tasks"] });
    },
  });
}

export const getLocalDateString = (date = new Date(), offsetHours = 0) => {
  // shift the date backwards by the offset so that e.g. 1:00 AM becomes 23:00 yesterday
  const shiftedDate = new Date(date.getTime() - offsetHours * 3600000);
  const offset = shiftedDate.getTimezoneOffset();
  const localDate = new Date(shiftedDate.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

export const getYesterdayLocalDateString = (date = new Date(), offsetHours = 0) => {
  const yesterday = new Date(date.getTime() - 86400000);
  return getLocalDateString(yesterday, offsetHours);
};

export const getDatesBetween = (startStr: string, endStr: string): string[] => {
  const dates: string[] = [];
  const startParts = startStr.split("-").map(Number);
  const endParts = endStr.split("-").map(Number);
  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  
  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export function useRecalculatePoints() {
  const { isDemo, demoData } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      let offsetHours = 0;
      if (!isDemo) {
        const { data: settingsData } = await supabase.from('settings').select('day_start_hour').limit(1).single();
        if (settingsData?.day_start_hour) {
          offsetHours = settingsData.day_start_hour;
        }
      } else {
        offsetHours = demoData.settings.day_start_hour || 0;
      }
      const today = getLocalDateString(new Date(), offsetHours);
      const yesterday = getYesterdayLocalDateString(new Date(), offsetHours);

      if (isDemo) {
        let points = demoData.user_points[0];
        if (!points) {
          points = {
            id: "demo-points",
            total_points: 0,
            current_streak: 0,
            best_streak: 0,
            last_active_date: yesterday,
            updated_at: new Date().toISOString()
          };
          demoData.user_points = [points];
        }
        let streak = points.current_streak || 0;
        let total_points = points.total_points || 0;
        let best_streak = points.best_streak || 0;
        let lastActive = points.last_active_date || yesterday;

        if (lastActive === today) {
          return points; // already settled today
        }

        const datesToSettle = getDatesBetween(lastActive, yesterday);
        for (const d of datesToSettle) {
          const tasks = (demoData.daily_tasks || []).filter((t: any) => t.task_date === d);
          const completed = tasks.filter((t: any) => t.is_completed);
          const base_sum = completed.reduce((s: number, t: any) => s + (t.base_points || 0), 0);
          const total = tasks.length;
          const pct = total > 0 ? completed.length / total : 0;
          const completion_bonus = pct >= 0.8 || pct === 1 ? 50 : completed.length >= 1 ? 15 : 0;

          if (completed.length > 0) {
            streak += 1;
          } else {
            streak = 0;
          }
          const streak_mult = streak >= 30 ? 3 : streak >= 14 ? 2 : streak >= 7 ? 1.5 : 1;
          const day_points = Math.round((base_sum + completion_bonus) * streak_mult);
          total_points += day_points;
          best_streak = Math.max(best_streak, streak);
        }

        points.total_points = total_points;
        points.current_streak = streak;
        points.best_streak = best_streak;
        points.last_active_date = today;
        points.updated_at = new Date().toISOString();
        return points;
      }

      // Online mode (Supabase)
      const { data: points, error: pErr } = await supabase
        .from("user_points")
        .select("*")
        .maybeSingle();
      if (pErr) throw pErr;

      if (!points) {
        // No points record yet, create one
        const { data: created, error: cErr } = await supabase
          .from("user_points")
          .insert({ total_points: 0, current_streak: 0, best_streak: 0, last_active_date: today })
          .select()
          .single();
        if (cErr) throw cErr;
        return created;
      }

      let lastActive = points.last_active_date;
      if (!lastActive) {
        lastActive = yesterday;
      }

      if (lastActive === today) {
        return points; // already settled today
      }

      const datesToSettle = getDatesBetween(lastActive, yesterday);
      let streak = points.current_streak || 0;
      let total_points = points.total_points || 0;
      let best_streak = points.best_streak || 0;

      for (const d of datesToSettle) {
        const { data: tasks, error: tErr } = await supabase
          .from("daily_tasks")
          .select("base_points, is_completed")
          .eq("task_date", d);
        if (tErr) throw tErr;

        const completed = (tasks || []).filter((t) => t.is_completed);
        const base_sum = completed.reduce((s, t) => s + (t.base_points || 0), 0);
        const total = (tasks || []).length;
        const pct = total > 0 ? completed.length / total : 0;
        const completion_bonus = pct >= 0.8 || pct === 1 ? 50 : completed.length >= 1 ? 15 : 0;

        if (completed.length > 0) {
          streak += 1;
        } else {
          streak = 0;
        }
        const streak_mult = streak >= 30 ? 3 : streak >= 14 ? 2 : streak >= 7 ? 1.5 : 1;
        const day_points = Math.round((base_sum + completion_bonus) * streak_mult);
        total_points += day_points;
        best_streak = Math.max(best_streak, streak);
      }

      const { data: updated, error: uErr } = await supabase
        .from("user_points")
        .update({
          total_points,
          current_streak: streak,
          best_streak,
          last_active_date: today,
          updated_at: new Date().toISOString()
        })
        .eq("id", points.id)
        .select()
        .single();
      if (uErr) throw uErr;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_points"] });
    },
  });
}

export interface Evaluation4D {
  cognitive_level: number;
  willpower_level: number;
  duration_level: number;
  impact_level: number;
  awarded_xp: number;
  attribute_tags: string[];
  ai_encouragement: string;
}

export function useEstimateDifficulty() {
  return useMutation({
    mutationFn: async (titles: string[]) => {
      const { data, error } = await supabase.functions.invoke("estimate-difficulty", {
        body: { titles },
      });
      if (error) throw error;
      return data as { results: { title: string; difficulty: string; evaluation?: Evaluation4D }[] };
    },
  });
}

// ============ Shop System ============

export const shopItemsHooks = useCrudHooks("shop_items", "shop_items");
export const userInventoryHooks = useCrudHooks("user_inventory", "user_inventory");
export const gachaPityHooks = useCrudHooks("gacha_pity", "gacha_pity");

export function useShopItems() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["shop_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_items")
        .select("*")
        .eq("is_active", true)
        .order("rarity", { ascending: true })
        .order("price", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    return { data: (demoData as any).shop_items?.filter((i: any) => i.is_active) || [], isLoading: false, error: null } as any;
  }
  return supa;
}

export function useUserInventory() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["user_inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("*, shop_items(*)")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const inv = (demoData as any).user_inventory || [];
    const items = (demoData as any).shop_items || [];
    const enriched = inv.map((invItem: any) => ({
      ...invItem,
      shop_items: items.find((i: any) => i.id === invItem.item_id) || null,
    }));
    return { data: enriched, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useGachaPity() {
  const { isDemo, demoData } = useDemoMode();
  const queryClient = useQueryClient();
  const supa = useQuery({
    queryKey: ["gacha_pity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gacha_pity")
        .select("*")
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from("gacha_pity")
          .insert({ pulls_since_legendary: 0, total_pulls: 0 })
          .select()
          .single();
        if (createErr) throw createErr;
        queryClient.invalidateQueries({ queryKey: ["gacha_pity"] });
        return created as any;
      }
      return data as any;
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const pity = (demoData as any).gacha_pity?.[0] || { pulls_since_legendary: 0, total_pulls: 0 };
    return { data: pity, isLoading: false, error: null } as any;
  }
  return supa;
}

export function useSpendablePoints() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["spendable_points"],
    queryFn: async () => {
      const { data: points, error: pErr } = await supabase
        .from("user_points")
        .select("total_points")
        .single();
      if (pErr) throw pErr;
      const { data: inventory, error: iErr } = await supabase
        .from("user_inventory")
        .select("shop_items(price)")
        .eq("source", "shop_purchase");
      if (iErr) throw iErr;
      const spent = (inventory || []).reduce((sum: number, inv: any) => sum + (inv.shop_items?.price || 0), 0);
      return (points?.total_points || 0) - spent;
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const pts = (demoData as any).user_points?.[0]?.total_points || 0;
    return { data: pts, isLoading: false, error: null } as any;
  }
  return supa;
}

export function usePullGacha() {
  const { isDemo, demoData, addRecord } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pullCount: 1 | 10) => {
      const cost = pullCount === 1 ? 100 : 900;

      if (isDemo) {
        const pts = (demoData as any).user_points?.[0];
        if (!pts || pts.total_points < cost) throw new Error("Insufficient points");
        pts.total_points -= cost;
        const allItems = (demoData as any).shop_items || [];
        const owned = new Set(((demoData as any).user_inventory || []).map((i: any) => i.item_id));
        const available = allItems.filter((i: any) => i.is_active && !owned.has(i.id));
        const results: any[] = [];
        for (let i = 0; i < pullCount; i++) {
          const roll = Math.random() * 100;
          let rarity = roll < 10 ? "legendary" : roll < 40 ? "rare" : "common";
          let pool = available.filter((item: any) => item.rarity === rarity);
          if (pool.length === 0) pool = available.filter((item: any) => item.rarity !== "common");
          if (pool.length === 0) pool = available;
          if (pool.length === 0) throw new Error("Collection complete!");
          const picked = pool[Math.floor(Math.random() * pool.length)];
          const invItem = {
            id: crypto.randomUUID(),
            user_id: "demo-user",
            item_id: picked.id,
            source: "gacha_pull",
            is_equipped: false,
            is_used: false,
            purchased_at: new Date().toISOString(),
          };
          if (!(demoData as any).user_inventory) (demoData as any).user_inventory = [];
          (demoData as any).user_inventory.push(invItem);
          results.push({ ...invItem, shop_items: picked });
        }
        return results;
      }

      // Supabase path
      const { data: points, error: pErr } = await supabase
        .from("user_points")
        .select("total_points")
        .single();
      if (pErr) throw pErr;
      if ((points?.total_points || 0) < cost) throw new Error("Insufficient points");

      const { data: pity, error: pityErr } = await supabase
        .from("gacha_pity")
        .select("*")
        .maybeSingle();
      if (pityErr) throw pityErr;
      let pityData = pity || { id: null, pulls_since_legendary: 0, total_pulls: 0 };

      const { data: allItems, error: itemsErr } = await supabase
        .from("shop_items")
        .select("*")
        .eq("is_active", true);
      if (itemsErr) throw itemsErr;

      const { data: owned, error: ownedErr } = await supabase
        .from("user_inventory")
        .select("item_id");
      if (ownedErr) throw ownedErr;

      const ownedIds = new Set((owned || []).map((o) => o.item_id));
      const available = (allItems || []).filter((item) => !ownedIds.has(item.id));

      const results: any[] = [];
      let pullsSinceLeg = pityData.pulls_since_legendary;

      for (let i = 0; i < pullCount; i++) {
        let rarity: string;
        if (pullsSinceLeg >= 14) {
          rarity = "legendary";
          pullsSinceLeg = 0;
        } else {
          const roll = Math.random() * 100;
          rarity = roll < 10 ? "legendary" : roll < 40 ? "rare" : "common";
          if (rarity === "legendary") pullsSinceLeg = 0;
          else pullsSinceLeg++;
        }

        let pool = available.filter((item) => item.rarity === rarity);
        if (pool.length === 0) {
          pool = available.filter((item) => item.rarity !== "common");
        }
        if (pool.length === 0) pool = available;
        if (pool.length === 0) throw new Error("Collection complete!");

        const picked = pool[Math.floor(Math.random() * pool.length)];
        const { data: invItem, error: invErr } = await supabase
          .from("user_inventory")
          .insert({ item_id: picked.id, source: "gacha_pull" })
          .select("*, shop_items(*)")
          .single();
        if (invErr) throw invErr;
        results.push(invItem);

        const idx = available.findIndex((a) => a.id === picked.id);
        if (idx >= 0) available.splice(idx, 1);
      }

      // Update pity
      if (pityData.id) {
        await supabase
          .from("gacha_pity")
          .update({
            pulls_since_legendary: pullsSinceLeg,
            total_pulls: (pityData.total_pulls || 0) + pullCount,
          })
          .eq("id", pityData.id);
      } else {
        await supabase
          .from("gacha_pity")
          .insert({ pulls_since_legendary: pullsSinceLeg, total_pulls: pullCount });
      }

      // Deduct points
      const newTotal = (points?.total_points || 0) - cost;
      await supabase
        .from("user_points")
        .update({ total_points: newTotal })
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["user_points"] });
      queryClient.invalidateQueries({ queryKey: ["gacha_pity"] });
      queryClient.invalidateQueries({ queryKey: ["spendable_points"] });
    },
  });
}

export function useBuyFromShop() {
  const { isDemo, demoData, addRecord } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (isDemo) {
        const items = (demoData as any).shop_items || [];
        const item = items.find((i: any) => i.id === itemId);
        if (!item) throw new Error("Item not found");
        const pts = (demoData as any).user_points?.[0];
        if (!pts || pts.total_points < (item.price || 0)) throw new Error("Insufficient points");
        pts.total_points -= item.price;
        const invItem = {
          id: crypto.randomUUID(),
          user_id: "demo-user",
          item_id: itemId,
          source: "shop_purchase",
          is_equipped: false,
          is_used: false,
          purchased_at: new Date().toISOString(),
        };
        if (!(demoData as any).user_inventory) (demoData as any).user_inventory = [];
        (demoData as any).user_inventory.push(invItem);
        return { ...invItem, shop_items: item };
      }

      const { data: item, error: itemErr } = await supabase
        .from("shop_items")
        .select("*")
        .eq("id", itemId)
        .single();
      if (itemErr) throw itemErr;
      if (!item.price) throw new Error("Item not purchasable");

      const { data: points, error: pErr } = await supabase
        .from("user_points")
        .select("total_points")
        .single();
      if (pErr) throw pErr;
      if ((points?.total_points || 0) < item.price) throw new Error("Insufficient points");

      const { data: invItem, error: invErr } = await supabase
        .from("user_inventory")
        .insert({ item_id: itemId, source: "shop_purchase" })
        .select("*, shop_items(*)")
        .single();
      if (invErr) throw invErr;

      const newTotal = (points?.total_points || 0) - item.price;
      await supabase
        .from("user_points")
        .update({ total_points: newTotal })
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      return invItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["user_points"] });
      queryClient.invalidateQueries({ queryKey: ["spendable_points"] });
    },
  });
}

export function useEquipItem() {
  const { isDemo, demoData } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inventoryId, itemType }: { inventoryId: string; itemType: string }) => {
      if (isDemo) {
        const inv = (demoData as any).user_inventory || [];
        inv.forEach((item: any) => {
          const shopItem = ((demoData as any).shop_items || []).find((si: any) => si.id === item.item_id);
          if (shopItem?.item_type === itemType) item.is_equipped = false;
        });
        const target = inv.find((item: any) => item.id === inventoryId);
        if (target) target.is_equipped = true;
        return target;
      }

      // Unequip all items of same type
      const { data: currentItems, error: fetchErr } = await supabase
        .from("user_inventory")
        .select("id, shop_items(item_type)")
        .eq("is_equipped", true);
      if (fetchErr) throw fetchErr;

      for (const item of currentItems || []) {
        if ((item as any).shop_items?.item_type === itemType) {
          await supabase.from("user_inventory").update({ is_equipped: false }).eq("id", item.id);
        }
      }

      const { data, error } = await supabase
        .from("user_inventory")
        .update({ is_equipped: true })
        .eq("id", inventoryId)
        .select("*, shop_items(*)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_inventory"] });
    },
  });
}

export function useUseCoupon() {
  const { isDemo, demoData } = useDemoMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inventoryId: string) => {
      if (isDemo) {
        const inv = (demoData as any).user_inventory || [];
        const target = inv.find((item: any) => item.id === inventoryId);
        if (target) {
          target.is_used = true;
          const shopItem = ((demoData as any).shop_items || []).find((si: any) => si.id === target.item_id);
          if (shopItem?.metadata?.effect_type === "rest_day") {
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
            const pts = (demoData as any).user_points?.[0];
            if (pts) pts.rest_day_date = tomorrow;
          } else if (shopItem?.metadata?.effect_type === "skip_chore") {
            const pts = (demoData as any).user_points?.[0];
            if (pts) pts.skip_chore_active = true;
          } else if (shopItem?.metadata?.effect_type === "sleep_in") {
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
            const pts = (demoData as any).user_points?.[0];
            if (pts) pts.sleep_in_date = tomorrow;
          }
        }
        return target;
      }

      const { data: invItem, error: invErr } = await supabase
        .from("user_inventory")
        .select("*, shop_items(*)")
        .eq("id", inventoryId)
        .single();
      if (invErr) throw invErr;

      const effectType = (invItem as any).shop_items?.metadata?.effect_type;
      if (effectType === "rest_day") {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
        await supabase.from("user_points").update({ rest_day_date: tomorrow }).eq("user_id", invItem.user_id);
      } else if (effectType === "skip_chore") {
        await supabase.from("user_points").update({ skip_chore_active: true }).eq("user_id", invItem.user_id);
      } else if (effectType === "sleep_in") {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
        await supabase.from("user_points").update({ sleep_in_date: tomorrow }).eq("user_id", invItem.user_id);
      }

      const { data, error } = await supabase
        .from("user_inventory")
        .update({ is_used: true })
        .eq("id", inventoryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["user_points"] });
    },
  });
}
