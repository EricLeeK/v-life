import { supabase } from "@/integrations/supabase/client";
import type { DailyScores, ZodiacSign } from "./types";
import { FORTUNE_RULE_SOURCES } from "./ruleVersion";

export interface HoroscopeDay {
  sign: ZodiacSign;
  date: string;
  text: string;
  stars: DailyScores;
  source: string;
}

export async function fetchHoroscope(sign: ZodiacSign): Promise<
  { ok: true; data: HoroscopeDay } | { ok: false; error: string }
> {
  const { data, error } = await supabase.functions.invoke("fortune-horoscope", {
    body: { sign },
  });

  if (error) {
    return {
      ok: false,
      error: (data as { error?: string } | null)?.error || error.message || "horoscope request failed",
    };
  }
  if ((data as { error?: string } | null)?.error) {
    return { ok: false, error: (data as { error: string }).error };
  }

  const row = data as {
    sign?: string;
    date?: string;
    text?: string;
    stars?: Partial<DailyScores>;
    source?: string;
  } | null;

  const text = String(row?.text || "").trim();
  if (!text) return { ok: false, error: "empty horoscope" };

  const overall = Number(row?.stars?.overall) || 3;
  return {
    ok: true,
    data: {
      sign,
      date: String(row?.date || ""),
      text,
      stars: {
        overall,
        love: Number(row?.stars?.love) || overall,
        career: Number(row?.stars?.career) || overall,
        wealth: Number(row?.stars?.wealth) || overall,
      },
      source: String(row?.source || FORTUNE_RULE_SOURCES.horoscopeApi),
    },
  };
}

/** Map API overall stars (1–5) to dailyScores zodiacFactor [-1,1]. */
export function zodiacFactorFromStars(overall: number): number {
  return (Math.min(5, Math.max(1, overall)) - 3) / 2;
}
