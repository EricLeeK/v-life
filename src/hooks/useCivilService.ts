import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  advanceReviewFields,
  initialReviewFields,
  masteredReviewFields,
  resetPendingReviewFields,
  type CivilXingcePaper,
} from "@/lib/civilXingcePaper";

export type CivilExam = Tables<"civil_exams">;
export type CivilPlanItem = Tables<"civil_plan_items">;
export type CivilCheckin = Tables<"civil_checkins">;
export type CivilWrongAnswer = Tables<"civil_wrong_answers">;
export type { CivilXingcePaper };

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

// ============ Exams ============
export function useCivilExams(includeArchived = false) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["civil_exams", includeArchived],
    queryFn: async () => {
      let q = supabase.from("civil_exams").select("*").order("exam_date", { ascending: true });
      if (!includeArchived) q = q.eq("is_archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return data as CivilExam[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    let list = [...(demoData.civil_exams || [])];
    if (!includeArchived) list = list.filter((e) => !e.is_archived);
    list.sort((a, b) => a.exam_date.localeCompare(b.exam_date));
    return { data: list, isLoading: false, error: null } as typeof supa;
  }
  return supa;
}

export function usePrimaryExam() {
  const { data: exams, ...rest } = useCivilExams(false);
  const primary = exams?.find((e) => e.is_primary) || exams?.[0] || null;
  return { data: primary, exams, ...rest };
}

export function useCreateCivilExam() {
  const { isDemo, addRecord, updateRecord, demoData } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();

  const supa = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"civil_exams">, "user_id"> & { user_id?: string }) => {
      const userId = input.user_id || user?.id;
      if (!userId) throw new Error("Not authenticated");
      if (input.is_primary) {
        await supabase.from("civil_exams").update({ is_primary: false }).eq("user_id", userId);
      }
      const { data, error } = await supabase
        .from("civil_exams")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as CivilExam;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_exams"] }),
  });

  if (isDemo) {
    return {
      mutate: (input: any) => {
        if (input.is_primary) {
          (demoData.civil_exams || []).forEach((e: any) => {
            if (e.is_primary) updateRecord("civil_exams", e.id, { is_primary: false });
          });
        }
        addRecord("civil_exams", { ...input, user_id: "demo-user", is_archived: false });
        qc.invalidateQueries({ queryKey: ["civil_exams"] });
      },
      mutateAsync: async (input: any) => {
        if (input.is_primary) {
          (demoData.civil_exams || []).forEach((e: any) => {
            if (e.is_primary) updateRecord("civil_exams", e.id, { is_primary: false });
          });
        }
        const row = addRecord("civil_exams", { ...input, user_id: "demo-user", is_archived: false });
        qc.invalidateQueries({ queryKey: ["civil_exams"] });
        return row;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateCivilExam() {
  const { isDemo, updateRecord, demoData } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();

  const supa = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"civil_exams"> & { id: string }) => {
      if (updates.is_primary && user?.id) {
        await supabase.from("civil_exams").update({ is_primary: false }).eq("user_id", user.id);
      }
      const { data, error } = await supabase.from("civil_exams").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CivilExam;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_exams"] }),
  });

  if (isDemo) {
    return {
      mutate: ({ id, ...updates }: any) => {
        if (updates.is_primary) {
          (demoData.civil_exams || []).forEach((e: any) => {
            if (e.is_primary && e.id !== id) updateRecord("civil_exams", e.id, { is_primary: false });
          });
        }
        updateRecord("civil_exams", id, updates);
        qc.invalidateQueries({ queryKey: ["civil_exams"] });
      },
      mutateAsync: async ({ id, ...updates }: any) => {
        if (updates.is_primary) {
          (demoData.civil_exams || []).forEach((e: any) => {
            if (e.is_primary && e.id !== id) updateRecord("civil_exams", e.id, { is_primary: false });
          });
        }
        updateRecord("civil_exams", id, updates);
        qc.invalidateQueries({ queryKey: ["civil_exams"] });
        return { id, ...updates };
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteCivilExam() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("civil_exams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_exams"] }),
  });
  if (isDemo) {
    return {
      mutate: (id: string) => {
        deleteRecord("civil_exams", id);
        qc.invalidateQueries({ queryKey: ["civil_exams"] });
      },
      mutateAsync: async (id: string) => {
        deleteRecord("civil_exams", id);
        qc.invalidateQueries({ queryKey: ["civil_exams"] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}

// ============ Plan items ============
export function useCivilPlanItems(filters?: { plan_date?: string; subject_group?: string }) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["civil_plan_items", filters],
    queryFn: async () => {
      let q = supabase.from("civil_plan_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (filters?.plan_date) q = q.eq("plan_date", filters.plan_date);
      if (filters?.subject_group) q = q.eq("subject_group", filters.subject_group);
      const { data, error } = await q;
      if (error) throw error;
      return data as CivilPlanItem[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    let list = [...(demoData.civil_plan_items || [])];
    if (filters?.plan_date) list = list.filter((p) => p.plan_date === filters.plan_date);
    if (filters?.subject_group) list = list.filter((p) => p.subject_group === filters.subject_group);
    list.sort((a, b) => (a.sort_order - b.sort_order) || a.created_at!.localeCompare(b.created_at!));
    return { data: list, isLoading: false, error: null } as typeof supa;
  }
  return supa;
}

export function useTodayCivilPlans() {
  return useCivilPlanItems({ plan_date: todayStr() });
}

export function useCreateCivilPlanItem() {
  const { isDemo, addRecord } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"civil_plan_items">, "user_id"> & { user_id?: string }) => {
      const userId = input.user_id || user?.id;
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("civil_plan_items")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as CivilPlanItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_plan_items"] }),
  });
  if (isDemo) {
    return {
      mutate: (input: any) => {
        addRecord("civil_plan_items", { ...input, user_id: "demo-user", is_completed: false });
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
      },
      mutateAsync: async (input: any) => {
        const row = addRecord("civil_plan_items", { ...input, user_id: "demo-user", is_completed: false });
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
        return row;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateCivilPlanItem() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"civil_plan_items"> & { id: string }) => {
      const { data, error } = await supabase.from("civil_plan_items").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CivilPlanItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_plan_items"] }),
  });
  if (isDemo) {
    return {
      mutate: ({ id, ...updates }: any) => {
        updateRecord("civil_plan_items", id, updates);
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
      },
      mutateAsync: async ({ id, ...updates }: any) => {
        updateRecord("civil_plan_items", id, updates);
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
        return { id, ...updates };
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteCivilPlanItem() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("civil_plan_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_plan_items"] }),
  });
  if (isDemo) {
    return {
      mutate: (id: string) => {
        deleteRecord("civil_plan_items", id);
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
      },
      mutateAsync: async (id: string) => {
        deleteRecord("civil_plan_items", id);
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useToggleCivilPlanComplete() {
  const update = useUpdateCivilPlanItem();
  return {
    ...update,
    mutate: (item: CivilPlanItem) => {
      update.mutate({
        id: item.id,
        is_completed: !item.is_completed,
        completed_at: !item.is_completed ? new Date().toISOString() : null,
      });
    },
    mutateAsync: async (item: CivilPlanItem) => {
      return update.mutateAsync({
        id: item.id,
        is_completed: !item.is_completed,
        completed_at: !item.is_completed ? new Date().toISOString() : null,
      });
    },
  };
}

// ============ Checkins ============
export function useCivilCheckins() {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["civil_checkins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("civil_checkins").select("*").order("date", { ascending: true });
      if (error) throw error;
      return data as CivilCheckin[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    const list = [...(demoData.civil_checkins || [])].sort((a, b) => a.date.localeCompare(b.date));
    return { data: list, isLoading: false, error: null } as typeof supa;
  }
  return supa;
}

export function useTodayCivilCheckin() {
  const { data: all, ...rest } = useCivilCheckins();
  const today = todayStr();
  return { data: all?.find((c) => c.date === today) || null, ...rest };
}

export function useUpsertCivilCheckin() {
  const { isDemo, addRecord, updateRecord, demoData } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (input: { date?: string; studied_minutes: number; note?: string | null }) => {
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");
      const date = input.date || todayStr();
      const { data, error } = await supabase
        .from("civil_checkins")
        .upsert(
          { user_id: userId, date, studied_minutes: input.studied_minutes, note: input.note ?? null },
          { onConflict: "user_id,date" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as CivilCheckin;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_checkins"] }),
  });
  if (isDemo) {
    return {
      mutate: (input: any) => {
        const date = input.date || todayStr();
        const existing = (demoData.civil_checkins || []).find((c: any) => c.date === date);
        if (existing) updateRecord("civil_checkins", existing.id, { studied_minutes: input.studied_minutes, note: input.note ?? null });
        else addRecord("civil_checkins", { date, studied_minutes: input.studied_minutes, note: input.note ?? null, user_id: "demo-user" });
        qc.invalidateQueries({ queryKey: ["civil_checkins"] });
      },
      mutateAsync: async (input: any) => {
        const date = input.date || todayStr();
        const existing = (demoData.civil_checkins || []).find((c: any) => c.date === date);
        if (existing) {
          updateRecord("civil_checkins", existing.id, { studied_minutes: input.studied_minutes, note: input.note ?? null });
          qc.invalidateQueries({ queryKey: ["civil_checkins"] });
          return { ...existing, studied_minutes: input.studied_minutes };
        }
        const row = addRecord("civil_checkins", { date, studied_minutes: input.studied_minutes, note: input.note ?? null, user_id: "demo-user" });
        qc.invalidateQueries({ queryKey: ["civil_checkins"] });
        return row;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

// ============ Wrong answers ============
export function useCivilWrongAnswers(filters?: { subject_group?: string; review_status?: string }) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["civil_wrong_answers", filters],
    queryFn: async () => {
      let q = supabase.from("civil_wrong_answers").select("*").order("source_date", { ascending: false });
      if (filters?.subject_group) q = q.eq("subject_group", filters.subject_group);
      if (filters?.review_status) q = q.eq("review_status", filters.review_status);
      const { data, error } = await q;
      if (error) throw error;
      return data as CivilWrongAnswer[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    let list = [...(demoData.civil_wrong_answers || [])];
    if (filters?.subject_group) list = list.filter((w) => w.subject_group === filters.subject_group);
    if (filters?.review_status) list = list.filter((w) => w.review_status === filters.review_status);
    list.sort((a, b) => b.source_date.localeCompare(a.source_date));
    return { data: list, isLoading: false, error: null } as typeof supa;
  }
  return supa;
}

export function useCreateCivilWrongAnswer() {
  const { isDemo, addRecord } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"civil_wrong_answers">, "user_id"> & { user_id?: string }) => {
      const userId = input.user_id || user?.id;
      if (!userId) throw new Error("Not authenticated");
      const sourceDate = input.source_date || todayStr();
      const status = input.review_status || "pending";
      const review =
        status === "mastered"
          ? { ...masteredReviewFields(), review_interval_days: input.review_interval_days ?? 1 }
          : initialReviewFields(sourceDate);
      const { data, error } = await supabase
        .from("civil_wrong_answers")
        .insert({
          ...input,
          user_id: userId,
          source_date: sourceDate,
          review_status: status,
          ...review,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CivilWrongAnswer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] }),
  });
  if (isDemo) {
    return {
      mutate: (input: any) => {
        const sourceDate = input.source_date || todayStr();
        const status = input.review_status || "pending";
        const review = status === "mastered" ? masteredReviewFields() : initialReviewFields(sourceDate);
        addRecord("civil_wrong_answers", { ...input, ...review, user_id: "demo-user", review_status: status, source_date: sourceDate });
        qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] });
      },
      mutateAsync: async (input: any) => {
        const sourceDate = input.source_date || todayStr();
        const status = input.review_status || "pending";
        const review = status === "mastered" ? masteredReviewFields() : initialReviewFields(sourceDate);
        const row = addRecord("civil_wrong_answers", { ...input, ...review, user_id: "demo-user", review_status: status, source_date: sourceDate });
        qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] });
        return row;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateCivilWrongAnswer() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"civil_wrong_answers"> & { id: string }) => {
      const { data, error } = await supabase.from("civil_wrong_answers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CivilWrongAnswer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] }),
  });
  if (isDemo) {
    return {
      mutate: ({ id, ...updates }: any) => {
        updateRecord("civil_wrong_answers", id, updates);
        qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] });
      },
      mutateAsync: async ({ id, ...updates }: any) => {
        updateRecord("civil_wrong_answers", id, updates);
        qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] });
        return { id, ...updates };
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteCivilWrongAnswer() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("civil_wrong_answers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] }),
  });
  if (isDemo) {
    return {
      mutate: (id: string) => {
        deleteRecord("civil_wrong_answers", id);
        qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] });
      },
      mutateAsync: async (id: string) => {
        deleteRecord("civil_wrong_answers", id);
        qc.invalidateQueries({ queryKey: ["civil_wrong_answers"] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}

/** Upload wrong-answer image to storage; returns public URL */
export async function uploadCivilWrongImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("civil-wrong").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("civil-wrong").getPublicUrl(path);
  return data.publicUrl;
}

export function useDueCivilWrongAnswers(asOfDate = todayStr()) {
  const { data: all = [], ...rest } = useCivilWrongAnswers({ review_status: "pending" });
  const due = all.filter((w) => w.next_review_date && w.next_review_date <= asOfDate);
  return { data: due, ...rest };
}

export function useReviewCivilWrongAnswer() {
  const update = useUpdateCivilWrongAnswer();
  return {
    ...update,
    markReviewed: (item: CivilWrongAnswer) =>
      update.mutateAsync({
        id: item.id,
        ...advanceReviewFields(item.review_interval_days || 1),
      }),
    markMastered: (item: CivilWrongAnswer) =>
      update.mutateAsync({
        id: item.id,
        ...masteredReviewFields(),
      }),
    resetPending: (item: CivilWrongAnswer) =>
      update.mutateAsync({
        id: item.id,
        ...resetPendingReviewFields(item.source_date),
      }),
  };
}

// ============ Xingce papers ============
export function useCivilXingcePapers(filters?: { is_mock?: boolean }) {
  const { isDemo, demoData } = useDemoMode();
  const supa = useQuery({
    queryKey: ["civil_xingce_papers", filters],
    queryFn: async () => {
      let q = supabase.from("civil_xingce_papers").select("*").order("taken_date", { ascending: true });
      if (filters?.is_mock !== undefined) q = q.eq("is_mock", filters.is_mock);
      const { data, error } = await q;
      if (error) throw error;
      return data as CivilXingcePaper[];
    },
    enabled: !isDemo,
  });
  if (isDemo) {
    let list = [...((demoData as any).civil_xingce_papers || [])] as CivilXingcePaper[];
    if (filters?.is_mock !== undefined) list = list.filter((p) => p.is_mock === filters.is_mock);
    list.sort((a, b) => a.taken_date.localeCompare(b.taken_date));
    return { data: list, isLoading: false, error: null } as typeof supa;
  }
  return supa;
}

export function useCreateCivilXingcePaper() {
  const { isDemo, addRecord } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"civil_xingce_papers">, "user_id"> & { user_id?: string }) => {
      const userId = input.user_id || user?.id;
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("civil_xingce_papers")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as CivilXingcePaper;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] }),
  });
  if (isDemo) {
    return {
      mutate: (input: any) => {
        addRecord("civil_xingce_papers" as any, { ...input, user_id: "demo-user" });
        qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] });
      },
      mutateAsync: async (input: any) => {
        const row = addRecord("civil_xingce_papers" as any, { ...input, user_id: "demo-user" });
        qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] });
        return row;
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useUpdateCivilXingcePaper() {
  const { isDemo, updateRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"civil_xingce_papers"> & { id: string }) => {
      const { data, error } = await supabase.from("civil_xingce_papers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CivilXingcePaper;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] }),
  });
  if (isDemo) {
    return {
      mutate: ({ id, ...updates }: any) => {
        updateRecord("civil_xingce_papers" as any, id, updates);
        qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] });
      },
      mutateAsync: async ({ id, ...updates }: any) => {
        updateRecord("civil_xingce_papers" as any, id, updates);
        qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] });
        return { id, ...updates };
      },
      isPending: false,
    } as any;
  }
  return supa;
}

export function useDeleteCivilXingcePaper() {
  const { isDemo, deleteRecord } = useDemoMode();
  const qc = useQueryClient();
  const supa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("civil_xingce_papers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] }),
  });
  if (isDemo) {
    return {
      mutate: (id: string) => {
        deleteRecord("civil_xingce_papers" as any, id);
        qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] });
      },
      mutateAsync: async (id: string) => {
        deleteRecord("civil_xingce_papers" as any, id);
        qc.invalidateQueries({ queryKey: ["civil_xingce_papers"] });
      },
      isPending: false,
    } as any;
  }
  return supa;
}
