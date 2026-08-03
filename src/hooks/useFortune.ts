import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useSettings } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import type { FortuneProfile, FortuneReadingType } from "@/lib/fortune/types";
import { zodiacFromBirthDate, zodiacFromSunLongitude } from "@/lib/fortune/zodiac";
import { shengxiaoFromBirthDate } from "@/lib/fortune/shengxiao";
import type { Json } from "@/integrations/supabase/types";

function parseProfile(raw: unknown): FortuneProfile | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as FortuneProfile;
}

function deriveZodiac(birthDate: string, birthHour?: number | null) {
  if (birthHour != null && birthHour >= 0) {
    return zodiacFromSunLongitude(birthDate, birthHour).sign;
  }
  return zodiacFromBirthDate(birthDate);
}

export function useFortuneProfile() {
  const { data: settings, isLoading } = useSettings();
  const profile = useMemo(() => {
    const p = parseProfile((settings as { fortune_profile?: unknown } | undefined)?.fortune_profile);
    if (!p?.birth_date) return p;
    return {
      ...p,
      zodiac_sign: p.zodiac_sign || deriveZodiac(p.birth_date, p.birth_hour),
      shengxiao: p.shengxiao || shengxiaoFromBirthDate(p.birth_date),
    };
  }, [settings]);

  return { profile, isLoading, hasBirthDate: Boolean(profile?.birth_date) };
}

export function useFortuneDailyCache(date: string) {
  const { user } = useAuth();
  const { isDemo } = useDemoMode();
  return useQuery({
    queryKey: ["fortune_daily_cache", date],
    enabled: !isDemo && Boolean(user) && Boolean(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fortune_daily_cache")
        .select("*")
        .eq("cache_date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertFortuneDailyCache() {
  const { user } = useAuth();
  const { isDemo } = useDemoMode();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cache_date: string; payload: Record<string, unknown> }) => {
      if (isDemo || !user) return null;
      const { data, error } = await supabase
        .from("fortune_daily_cache")
        .upsert(
          {
            user_id: user.id,
            cache_date: input.cache_date,
            payload: input.payload as Json,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,cache_date" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fortune_daily_cache", vars.cache_date] });
    },
  });
}

export interface FortuneReadingRow {
  id: string;
  user_id: string;
  type: string;
  question: string | null;
  payload: Json;
  reading: string;
  created_at: string;
}

export function useFortuneReadings() {
  const { user } = useAuth();
  const { isDemo } = useDemoMode();
  const qc = useQueryClient();

  return useQuery({
    queryKey: ["fortune_readings"],
    enabled: isDemo || Boolean(user),
    queryFn: async () => {
      if (isDemo) {
        return (qc.getQueryData(["fortune_readings"]) as FortuneReadingRow[] | undefined) || [];
      }
      const { data, error } = await supabase
        .from("fortune_readings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as FortuneReadingRow[];
    },
    initialData: isDemo ? [] : undefined,
  });
}

export function useSaveFortuneReading() {
  const { user } = useAuth();
  const { isDemo } = useDemoMode();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: FortuneReadingType;
      question?: string;
      payload: Record<string, unknown>;
      reading: string;
    }) => {
      if (isDemo) {
        const row: FortuneReadingRow = {
          id: crypto.randomUUID(),
          user_id: "demo",
          type: input.type,
          question: input.question ?? null,
          payload: input.payload as Json,
          reading: input.reading,
          created_at: new Date().toISOString(),
        };
        const prev = (qc.getQueryData(["fortune_readings"]) as FortuneReadingRow[] | undefined) || [];
        qc.setQueryData(["fortune_readings"], [row, ...prev]);
        return row;
      }
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("fortune_readings")
        .insert({
          user_id: user.id,
          type: input.type,
          question: input.question ?? null,
          payload: input.payload as Json,
          reading: input.reading,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FortuneReadingRow;
    },
    onSuccess: () => {
      if (!isDemo) qc.invalidateQueries({ queryKey: ["fortune_readings"] });
    },
  });
}

export function useDeleteFortuneReading() {
  const { isDemo } = useDemoMode();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        const prev = (qc.getQueryData(["fortune_readings"]) as FortuneReadingRow[] | undefined) || [];
        qc.setQueryData(
          ["fortune_readings"],
          prev.filter((r) => r.id !== id),
        );
        return;
      }
      const { error } = await supabase.from("fortune_readings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!isDemo) qc.invalidateQueries({ queryKey: ["fortune_readings"] });
    },
  });
}

export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
