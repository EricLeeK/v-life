/** Browser-side daily AI reading cache (demo / guest / offline fallback). */
const PREFIX = "vlife:fortune:daily-ai:";

function key(date: string, lang: string) {
  return `${PREFIX}${date}:${lang}`;
}

export function readLocalDailyAi(date: string, lang: string): string | null {
  try {
    const v = localStorage.getItem(key(date, lang));
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function writeLocalDailyAi(date: string, lang: string, text: string) {
  try {
    localStorage.setItem(key(date, lang), text);
  } catch {
    /* ignore quota */
  }
}

export type DailyAiByLang = Partial<Record<"zh" | "en", string>>;

export function pickCachedDailyAi(
  payload: { aiBody?: string; aiByLang?: DailyAiByLang; aiLang?: string } | null | undefined,
  lang: "zh" | "en",
  date: string,
): string | null {
  const byLang = payload?.aiByLang?.[lang]?.trim();
  if (byLang) return byLang;
  // legacy single body: reuse only if same language tagged, or untagged (assume current)
  const legacy = payload?.aiBody?.trim();
  if (legacy && (!payload?.aiLang || payload.aiLang === lang)) return legacy;
  return readLocalDailyAi(date, lang);
}
