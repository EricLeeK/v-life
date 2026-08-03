import { supabase } from "@/integrations/supabase/client";
import type { DailyScores, ZodiacSign } from "./types";
import { FORTUNE_RULE_SOURCES } from "./ruleVersion";

export interface HoroscopeDay {
  sign: ZodiacSign;
  date: string;
  text: string;
  text_en?: string;
  text_zh?: string;
  translated?: boolean;
  stars: DailyScores;
  source: string;
  cached?: boolean;
}

export async function fetchHoroscope(
  sign: ZodiacSign,
  lang: "zh" | "en" = "en",
): Promise<{ ok: true; data: HoroscopeDay } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("fortune-horoscope", {
    body: { sign, lang },
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
    text_en?: string;
    text_zh?: string;
    translated?: boolean;
    stars?: Partial<DailyScores>;
    source?: string;
    cached?: boolean;
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
      text_en: row?.text_en,
      text_zh: row?.text_zh,
      translated: row?.translated,
      stars: {
        overall,
        love: Number(row?.stars?.love) || overall,
        career: Number(row?.stars?.career) || overall,
        wealth: Number(row?.stars?.wealth) || overall,
      },
      source: String(row?.source || FORTUNE_RULE_SOURCES.horoscopeApi),
      cached: Boolean(row?.cached),
    },
  };
}

/** Map API overall stars (1–5) to dailyScores zodiacFactor [-1,1]. */
export function zodiacFactorFromStars(overall: number): number {
  return (Math.min(5, Math.max(1, overall)) - 3) / 2;
}
